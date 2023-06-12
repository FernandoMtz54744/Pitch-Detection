import React, { useEffect, useState } from 'react'
import Detector from '../Pages/Detector'
import FFT from 'fft.js';
import Grafica from '../Pages/Grafica';
import Chart from 'chart.js/auto';

export default function DetectorContainer() {
  const [nota, setNota] = useState("Nota");
  const frequencyData = new Array(2048);
  const [data, setData] = useState({
    labels: frequencyData, 
    datasets: [
      {
        label: 'Original',
        data: [],
        fill: false,
        borderColor: 'rgba(75,192,192,1)',
        tension: 0.1,
      },
      {
        label: 'IFFT',
        data: [],
        fill: false,
        borderColor: 'rgba(255,192,192,1)',
        tension: 0.1,
      },
    ],
  });
  const [options] = useState({
    scales: {
      x: {
        title: {
          display: true,
          text: 'Frequency',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Amplitude',
        },
      },
    },
  });

  useEffect(()=>{
    for (let i = 0; i < 2048; i++) {
      frequencyData[i] = i*48000/2048;
    }
    noteDetectionAutocorrelation(setNota, data, setData);
  },[]);     

  return (
    <>
      <Detector nota={nota}/>
      {/* <Grafica data={data} options={options}/> */}
    </>
  )
}

function noteDetectionAutocorrelation(setNota, data, setData){ // Detector de notas uasndo la autocorrelación en su método simple
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
            const freq = autoCorrelateFFT(buffer, audioContext.sampleRate, data, setData); //Se realiza la autocorrelación
            if(freq  < 0){
                setNota("Muy silencioso")
            }else{
                setNota(noteFromPitch(freq) + " : " + freq)
            }
        }, 100)
        }).catch(function(error) {
          console.log("Error: " + error)
        });
}

function autoCorrelate(buffer, sampleRate) {
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

  return sampleRate/T0;
}

function noteFromPitch( frequency ) {
  var noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  var noteNum = 12 * (Math.log( frequency / 440 )/Math.log(2) );
  return noteStrings[(Math.round( noteNum ) + 69)%12];
}


// ******************************Autocorrelación con FFT**********************+

function autoCorrelateFFT(buffer, sampleRate, data, setData) {
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
    // fftResult = fftResult.map(value => Math.pow(Math.abs(value), 2)); //Con esto funciona 

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

    setData({
      ...data, 
      datasets: [
        {
          label: 'Original',
          data: buffer,
          fill: false,
          borderColor: 'rgba(75,192,192,1)',
          tension: 0.1,
        },
        {
          label: 'IFFT',
          data: c,
          fill: false,
          borderColor: 'rgba(255,192,192,1)',
          tension: 0.1,
        },
      ],
    })

    return sampleRate/T0;
}


