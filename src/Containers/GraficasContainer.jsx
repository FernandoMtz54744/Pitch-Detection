import React, { useEffect, useState } from 'react'
import FFT from 'fft.js';
import Chart from 'chart.js/auto';
import { Line } from 'react-chartjs-2';

export default function Comparador() {
  const [notaSimple, setNotaSimple] = useState("Nota con el método simple");
  const [notaFFT, setNotaFFT] = useState("Nota con el método FFT");

  const timeDomain = Array.from(Array(1024).keys());
  const timeDomainAutocorrelation = Array.from(Array(1024).keys()); //Moverlo a 1024 o 2048 junto con la escala x
  const timeDomainOptions = {
    animation: false,
    plugins: {title: {display: true, text: "Señal de audio"}},
    scales: {
      x: {title: {display: true, text: 'Time'}, type:"linear", min:0, max: 1024, ticks: {autoSkip: true, maxTicksLimit: 20}},
      y: {title: {display: true, text: 'Amplitude'}, type:"linear", min:-1, max: 1},
    }};

  const autocorrelationOptions = {
    animation: false,
    plugins: {title: {display: true, text: "Autocorrelación"}},
    scales: {
      x: {title: {display: true, text: 'Time'}, type:"linear", min:0, max: 1024, ticks: {autoSkip: true, maxTicksLimit: 20}},
      y: {title: {display: true, text: 'Amplitude'}, type:"linear"},
    }};

  const [timeDomainData, setTimeDomainData] = useState({
      labels: timeDomain, 
      datasets: [
        {
          label: 'Señal de audio',
          data: [],
          fill: false,
          borderColor: 'rgba(10, 147, 37 ,1)',
          backgroundColor: 'rgba(10, 147, 37,1)',
          tension: 0.1,
        }]
    });

    const [autoCorrelationData, setAutoCorrelationData] = useState({
      labels: timeDomainAutocorrelation, 
      datasets: [
        {
          label: 'Método simple',
          data: [],
          fill: false,
          borderColor: 'rgba(231, 20, 67 ,1)',
          backgroundColor: "rgba(231, 20, 67 ,1)",
          tension: 0.1,
        }, 
        {
          label: 'Método FFT',
          data: [],
          fill: false,
          borderColor: 'rgba(25, 54, 215 ,1)',
          backgroundColor: 'rgba(25, 54, 215 ,1)',
          tension: 0.1,
        }]
    });


  useEffect(()=>{
    noteDetection(setNotaSimple, setNotaFFT, setTimeDomainData, setAutoCorrelationData);
  },[]);     

  return (
    <>
      <h1>Método Simple: {notaSimple}</h1>
      <h1>Método con FFT: {notaFFT}</h1>
      <hr />
      <div className='graficas'>
        <div className='grafica'>
          <Line data={timeDomainData} options={timeDomainOptions}  />
        </div>
        <div className='grafica'>
          <Line data={autoCorrelationData} options={autocorrelationOptions} />
        </div>
      </div>
    </>
  )
}

function noteDetection(setNotaSimple, setNotaFFT, setTimeDomainData, setAutoCorrelationData){
  navigator.mediaDevices.getUserMedia({ audio: true }).then(function(mediaStream){ //Pide permiso de micrófono
      // Se vincula el nodo de entrada con el micrófono
      const audioContext = new AudioContext();
      const inputNode = audioContext.createMediaStreamSource(mediaStream);

      // Se configura el nodo de analisis y se vincula con nodo de entrada
      const analyserNode = audioContext.createAnalyser();
      analyserNode.minDecibels = -100;
      analyserNode.maxDecibels = -10;
      analyserNode.smoothingTimeConstant = 0.85;
      inputNode.connect(analyserNode);

      // Creando el buffer de datos
      const bufferLength = analyserNode.fftSize;
      const buffer = new Float32Array(bufferLength);

      setInterval(function(){
          analyserNode.getFloatTimeDomainData(buffer); //Se obtiene la señal en el dominio del tiempo (normalizado de -1 a 1)
          autocorrelation(buffer, audioContext.sampleRate, 
            setNotaSimple, setNotaFFT,
            setTimeDomainData, setAutoCorrelationData); //Se realiza la autocorrelación con ambos métodos
      }, 200)
      }).catch(function(error) {
        console.log("Error: " + error);
      });
}

function noteFromPitch( frequency ) {
  const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const noteNum = 12 * (Math.log( frequency / 440 )/Math.log(2) );
  return noteStrings[(Math.round( noteNum ) + 69)%12];
}

function autocorrelation(buffer, sampleRate, setNotaSimple, setNotaFFT, setTimeDomainData, setAutoCorrelationData) {
  // Obteniendo la RMS para saber si la amplitud eficaz es suficiente
  let SIZE = buffer.length;
  let sumOfSquares = 0;
  for (let i=0; i < SIZE; i++){
    let val = buffer[i];
    sumOfSquares += val * val;
  }
  let rms = Math.sqrt(sumOfSquares/SIZE)
  if (rms < 0.02) { //La señal no es suficiente para hacer análisis, es decir, no hay sonido
    setNotaSimple("Silencio")
    setNotaFFT("Silencio");
    return;
  }

  // Obtiene la autocorrelación
  const autocorrelacionSimple = simpleAutocorrelation(buffer, SIZE);
  const autocorrelacionFFT = fftAutocorrelation(buffer, SIZE);

  // Obtiene la frecuencia
  const freqSimple = getFrequencyFromAutocorrelation(autocorrelacionSimple, SIZE, sampleRate)
  const freqFFT = getFrequencyFromAutocorrelation(autocorrelacionFFT, SIZE, sampleRate)

  setNotaSimple(noteFromPitch(freqSimple) + " : " + freqSimple);
  setNotaFFT(noteFromPitch(freqFFT) + " : " + freqFFT);
  setTimeDomainData(prevTimeDomainData => ({...prevTimeDomainData, datasets: [{
    label: 'Señal de audio',
    data: buffer.slice(0,1024),
    fill: false,
    borderColor: 'rgba(10, 147, 37 ,1)',
    backgroundColor: 'rgba(10, 147, 37,1)',
    tension: 0.1,
  }]}));

  setAutoCorrelationData(prevAutocorrelationData => ({...prevAutocorrelationData, datasets: [
    {
      label: 'Método simple',
      data: autocorrelacionSimple,
      fill: false,
      borderColor: 'rgba(231, 20, 67 ,1)',
      backgroundColor: "rgba(231, 20, 67 ,1)",
      tension: 0.1,
    }, 
    {
      label: 'Método FFT',
      data: autocorrelacionFFT,
      fill: false,
      borderColor: 'rgba(25, 54, 215 ,1)',
      borderColor: 'rgba(25, 54, 215 ,1)',
      tension: 0.1,
    }]}))

}

// ******************** SIMPLE AUTOCORRELATION *********************************
function simpleAutocorrelation(buffer, SIZE){ //Autocorrelación con el método simple
  const c = new Array(SIZE).fill(0);  // Creando el arreglo para el resultado de autocorrelación
  for (let i = 0; i < SIZE; i++) {  // Para cada offset potencial, se calcula la suma de cada valor del buffer multiplicado por el valor del buffer en el offset
    for (let j = 0; j < SIZE - i; j++) {
      c[i] = c[i] + buffer[j] * buffer[j+i];
    }
  }

  return c
}

// ******************** FFT AUTOCORRELATION *********************************
function fftAutocorrelation(buffer, SIZE) { //Autocorrelacion con el método FFT
  const f = new FFT(SIZE);
  const fftResult = f.createComplexArray();
  f.realTransform(fftResult, buffer); //Aplica FFT
  f.completeSpectrum(fftResult);

  for (let i = 0; i < fftResult.length; i += 2) { //Multiplica por su conjugado (Obtiene el espectro de potencia)
      const real = fftResult[i];
      const imag = fftResult[i + 1];
      fftResult[i] = real * real + imag * imag;
      fftResult[i + 1] = 0;
  }

  let ifftResult = f.createComplexArray();
  f.inverseTransform(ifftResult, fftResult); //Obtiene su inversa
  const c = new Array(f.size);
  f.fromComplexArray(ifftResult, c); //Filtra solo la parte Real (la imaginaria es 0)

  return c;
}

function getFrequencyFromAutocorrelation(c, SIZE, sampleRate){
  // Buscando el último indice donde el valor es mayor al siguiente (el valle)
  let d = 0;
  while (c[d] > c[d+1]) {
    d++;
  }

  // Itera desde el valle hasta la mitad para encontrar el pico máximo (mitad porque es simétrica)
  var maxValue = -1;
  var maxIndex = -1;
  for (var i = d; i < SIZE/2; i++) {
    if (c[i] > maxValue) {
      maxValue = c[i];
      maxIndex = i;
    }
  }

  // Aplica interpolación para mayor precisión
  var T0 = maxIndex;
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