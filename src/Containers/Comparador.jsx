import React, { useEffect, useState } from 'react'
import FFT from 'fft.js';

export default function Comparador() {

  const [notaSimple, setNotaSimple] = useState("Nota con el método simple");
  const [notaFFT, setNotaFFT] = useState("Nota con el método FFT");

  useEffect(()=>{
    noteDetection(setNotaSimple, setNotaFFT);
  },[]);     

  return (
    <>
      <h1>Nota Simple: {notaSimple}</h1>
      <h1>Nota FFT: {notaFFT}</h1>
    </>
  )
}

function noteDetection(setNotaSimple, setNotaFFT){ // Detector de notas uasndo la autocorrelación en su método simple
  navigator.mediaDevices.getUserMedia({ audio: true }).then(function(mediaStream){ //Pide permiso de micrófono
      // Se vincula el nodo de entrada con el micrófono
      console.log("Microfono disponible");
      const audioContext = new AudioContext();
      const inputNode = audioContext.createMediaStreamSource(mediaStream);

      // Se configura el nodo de analisis y se vinculo con nodo de entrada
      const analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 2048;
      analyserNode.minDecibels = -100;
      analyserNode.maxDecibels = -10;
      analyserNode.smoothingTimeConstant = 0.85;
      inputNode.connect(analyserNode);

      // Obteniendo el buffer de datos
      const bufferLength = analyserNode.fftSize;
      const buffer = new Float32Array(bufferLength);

      setInterval(function(){
          analyserNode.getFloatTimeDomainData(buffer); //Se obtiene la señal en el dominio del tiempo (normalizado de -1 a 1)
          const freqSimple = autoCorrelate(buffer, audioContext.sampleRate); //Se realiza la autocorrelación
          const freqFFT = autoCorrelateFFT(buffer, audioContext.sampleRate); //Se realiza la autocorrelación
          if(freqSimple  < 0){
              setNotaSimple("Muy silencioso")
          }else{
            setNotaSimple(noteFromPitch(freqSimple) + " : " + freqSimple)
          }
          if(freqFFT  < 0){
            setNotaFFT("Muy silencioso")
        }else{
          setNotaFFT(noteFromPitch(freqFFT) + " : " + freqFFT)
        }
      }, 100)
      }).catch(function(error) {
        console.log("Error: " + error)
      });
}

function noteFromPitch( frequency ) {
  var noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  var noteNum = 12 * (Math.log( frequency / 440 )/Math.log(2) );
  return noteStrings[(Math.round( noteNum ) + 69)%12];
}

function autoCorrelate(buffer, sampleRate) {
  const start = performance.now();

  // Obteniendo la RMS para saber si la amplitud eficaz es suficiente
  let SIZE = buffer.length;
  let sumOfSquares = 0;
  for (let i=0; i < SIZE; i++){
    let val = buffer[i];
    sumOfSquares += val * val;
  }
  let rms = Math.sqrt(sumOfSquares/SIZE)
  if (rms < 0.02) { //La señal no es suficiente para hacer análisis, es decir, no hay sonido
    return -1;
  }

  // Creando un arreglo para la autocorrelación
  var c = new Array(SIZE).fill(0);
  for (let i = 0; i < SIZE; i++) {  // Para cada offset potencial, se calcula la suma de cada valor del buffer multiplicado por el valor del buffer en el offset
    for (let j = 0; j < SIZE - i; j++) {
      c[i] = c[i] + buffer[j] * buffer[j+i]
    }
  }

  // Find the last index where that value is greater than the next one (the dip-el valle)
  var d = 0;
  while (c[d] > c[d+1]) {
    d++;
  }

  // Iterate from that index through the end and find the maximum sum
  var maxValue = -1;
  var maxIndex = -1;
  for (var i = d; i < SIZE; i++) {
    if (c[i] > maxValue) {
      maxValue = c[i];
      maxIndex = i;
    }
  }

  var T0 = maxIndex;

  // From the original author:
  // interpolation is parabolic interpolation. It helps with precision. We suppose that a parabola pass through the
  // three points that comprise the peak. 'a' and 'b' are the unknowns from the linear equation system and b/(2a) is
  // the "error" in the abscissa. Well x1,x2,x3 should be y1,y2,y3 because they are the ordinates.
  var x1 = c[T0 - 1];
  var x2 = c[T0];
  var x3 = c[T0 + 1]

  var a = (x1 + x3 - 2 * x2) / 2;
  var b = (x3 - x1) / 2
  if (a) {
    T0 = T0 - b / (2 * a);
  }
  const end = performance.now();
  console.log("Simple: " + (end-start) + " ms");
  return sampleRate/T0;
}

// ***************FFT

function autoCorrelateFFT(buffer, sampleRate) {
  const start = performance.now();

  const SIZE = buffer.length;
  let sumOfSquares = 0;
  for (let i=0; i < SIZE; i++){
    let val = buffer[i];
    sumOfSquares += val * val;
  }
  let rms = Math.sqrt(sumOfSquares/SIZE)
  if (rms < 0.02) { //La señal no es suficiente para hacer análisis, es decir, no hay sonido
    return -1;
  }

  //APLICANDO AUTOCORRELACIÓN CON EL MÉTODO FFT 
  const f = new FFT(SIZE);
  let fftResult = f.createComplexArray();
  f.realTransform(fftResult, buffer)
  f.completeSpectrum(fftResult);

  for (let i = 0; i < fftResult.length; i += 2) { //Multiplica por su conjugado
      const real = fftResult[i];
      const imag = fftResult[i + 1];
      fftResult[i] = real * real + imag * imag;
      fftResult[i + 1] = 0;
  }

  let ifftResult = f.createComplexArray();
  f.inverseTransform(ifftResult, fftResult);
  let c = new Array(f.size);
  f.fromComplexArray(ifftResult, c)
  
  // Find the last index where that value is greater than the next one (the dip)
  var d = 0;
  while (c[d] > c[d+1]) {
    d++;
  }

  // Iterate from that index through the end and find the maximum
  var maxValue = -1;
  var maxIndex = -1;
  for (var i = d; i < SIZE/2; i++) {
    if (c[i] > maxValue) {
      maxValue = c[i];
      maxIndex = i;
    }
  }


  var T0 = maxIndex;

  var x1 = c[T0 - 1];
  var x2 = c[T0];
  var x3 = c[T0 + 1]

  var a = (x1 + x3 - 2 * x2) / 2;
  var b = (x3 - x1) / 2
  if (a) {
    T0 = T0 - b / (2 * a);
  }

  const end = performance.now();
  console.log("FFT: " + (end-start) + " ms");

  return sampleRate/T0;
}