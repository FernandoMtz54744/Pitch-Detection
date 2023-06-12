import React from 'react'
import { Line } from 'react-chartjs-2'

export default function Grafica({data, options}) {
  return (
    <div>
      <Line data={data} options={options} />
    </div>
  )
}
