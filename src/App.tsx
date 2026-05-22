import { useState, useMemo, useEffect } from 'react'
import './App.css'

// --- CONFIGURACIÓN MATRICIAL (Teoría de Hamming [7,4,3]) ---
const G = [
  [1, 0, 0, 0, 1, 1, 0],
  [0, 1, 0, 0, 1, 0, 1],
  [0, 0, 1, 0, 0, 1, 1],
  [0, 0, 0, 1, 1, 1, 1]
];

const H = [
  [1, 1, 0, 1, 1, 0, 0],
  [1, 0, 1, 1, 0, 1, 0],
  [0, 1, 1, 1, 0, 0, 1]
];

// --- FUNCIONES UTILERÍAS DE CONVERSIÓN ---
const stringToBits = (str: string): number[] => {
  const bits: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    const binStr = code.toString(2).padStart(8, '0');
    bits.push(...binStr.split('').map(Number));
  }
  return bits;
};

const bitsToString = (bits: number[]): string => {
  let str = '';
  for (let i = 0; i < bits.length; i += 8) {
    const byte = bits.slice(i, i + 8).join('');
    if (byte.length === 8) {
      str += String.fromCharCode(parseInt(byte, 2));
    }
  }
  return str;
};

export default function App() {
  const [originalText, setOriginalText] = useState('Hola mundo!');
  const [noiseBit, setNoiseBit] = useState(-1);
  const [showResult, setShowResult] = useState(false);

  // --- LÓGICA DE CODIFICACIÓN ---
  const originalBits = useMemo(() => stringToBits(originalText), [originalText]);

  // Agrupar en bloques de 4 bits y codificar a 7 bits
  const encodedStream = useMemo(() => {
    const stream: number[] = [];
    for (let i = 0; i < originalBits.length; i += 4) {
      let block = originalBits.slice(i, i + 4);
      while (block.length < 4) block.push(0);

      // Multiplicación matricial bloque * G mod 2
      const encodedBlock = Array(7).fill(0);
      for (let col = 0; col < 7; col++) {
        let sum = 0;
        for (let row = 0; row < 4; row++) {
          sum += block[row] * G[row][col];
        }
        encodedBlock[col] = sum % 2;
      }
      stream.push(...encodedBlock);
    }
    return stream;
  }, [originalBits]);

  // Elegir un bit de ruido aleatorio cada vez que el flujo codificado cambie
  useEffect(() => {
    if (encodedStream.length > 0) {
      const randomIndex = Math.floor(Math.random() * encodedStream.length);
      setNoiseBit(randomIndex);
    } else {
      setNoiseBit(-1);
    }
    setShowResult(false);
  }, [encodedStream]);

  // --- LÓGICA DEL CANAL (INYECCIÓN DE RUIDO) ---
  let receivedStream = [...encodedStream];
  if (noiseBit >= 0 && noiseBit < receivedStream.length) {
    receivedStream[noiseBit] = receivedStream[noiseBit] === 1 ? 0 : 1; // Invertir bit
  }

  // Convertir el flujo ruidoso de 7 bits directamente a texto para ver la corrupción
  // Nota: Al romper la estructura de paridad, el texto se distorsionará de forma caótica.
  let corruptedBinaryText = [];
  for (let i = 0; i < receivedStream.length; i += 7) {
    corruptedBinaryText.push(...receivedStream.slice(i, i + 4));
  }
  const corruptedVisualText = bitsToString(corruptedBinaryText);

  // --- LÓGICA DE DECODIFICACIÓN Y CORRECCIÓN (RECEPTOR) ---
  let correctedStream = [];
  let detectedErrorBitGlobal = -1;

  for (let b = 0; b < receivedStream.length; b += 7) {
    let block7 = receivedStream.slice(b, b + 7);

    // Calcular Síndrome: S = bloque7 * H^T mod 2
    let syndrome = Array(3).fill(0);
    for (let rowH = 0; rowH < 3; rowH++) {
      let sum = 0;
      for (let c = 0; c < 7; c++) {
        sum += block7[c] * H[rowH][c];
      }
      syndrome[rowH] = sum % 2;
    }

    // Si el síndrome != [0,0,0], buscar la columna errónea
    const hasError = syndrome.some(val => val !== 0);
    if (hasError) {
      for (let col = 0; col < 7; col++) {
        let matches = true;
        for (let row = 0; row < 3; row++) {
          if (H[row][col] !== syndrome[row]) matches = false;
        }
        if (matches) {
          block7[col] = block7[col] === 1 ? 0 : 1; // ¡Corrección!
          detectedErrorBitGlobal = b + col;
          break;
        }
      }
    }
    // Extraer solo los 4 bits de datos originales
    correctedStream.push(...block7.slice(0, 4));
  }

  const finalRecoveredText = bitsToString(correctedStream);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">📡 SecureCom - Hamming [7,4,3]</h1>
        <p className="app-subtitle">Proyecto Práctico de Teoría de Códigos • Esteban Arnedo y Robert Lindado</p>
      </header>

      <div className="grid-container">
        
        {/* COLUMNA 1: EMISOR */}
        <div className="card">
          <div className="card-header">
            <span className="badge badge-emisor">USUARIO 1</span>
            <h2 className="card-title">Emisor</h2>
          </div>
          <label className="label-text">Escribe tu mensaje en texto plano:</label>
          <textarea
            className="textarea-input"
            value={originalText}
            onChange={(e) => { setOriginalText(e.target.value); setShowResult(false); }}
          />
          <div className="info-box">
            <span className="info-box-title">Flujo Binario de Datos (k bits):</span> <br/>
            {originalBits.join('') || 'Vacío'}
          </div>
          <div className="info-box-codificado">
            <span className="info-box-title">Codificado con Matriz G (n bits):</span> <br/>
            {encodedStream.join('') || 'Vacío'}
          </div>
        </div>

        {/* COLUMNA 2: EL CANAL (RUIDO) */}
        <div className="card card-flex">
          <div>
            <div className="card-header">
              <span className="badge badge-canal">MEDIO</span>
              <h2 className="card-title">Canal de Transmisión</h2>
            </div>
            <p className="label-text">
              Simula la interferencia en el entorno. Selecciona un bit del flujo total de transmisión para corromperlo:
            </p>
            
            {encodedStream.length > 0 ? (
              <div className="bits-grid">
                {encodedStream.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => { setNoiseBit(index); setShowResult(false); }}
                    className={`bit-button ${noiseBit === index ? 'error' : ''}`}
                    title={`Posición del bit: ${index}`}
                  >
                    {receivedStream[index]}
                  </button>
                ))}
              </div>
            ) : <p className="text-xs text-red-400">Introduce texto para generar bits.</p>}
          </div>

          <div className="mt-4">
            <button
              onClick={() => { setNoiseBit(-1); setShowResult(false); }}
              className="btn-clear"
            >
              Limpiar Ruido
            </button>
            <button
              onClick={() => setShowResult(true)}
              className="btn-send"
            >
              Enviar al Receptor
            </button>
          </div>
        </div>

        {/* COLUMNA 3: RECEPTOR */}
        <div className="card">
          <div className="card-header">
            <span className="badge badge-receptor">USUARIO 2</span>
            <h2 className="card-title">Receptor</h2>
          </div>

          <label className="label-text">Mensaje recibido (en tránsito/corrupto):</label>
          <div className="receptor-screen">
            {noiseBit !== -1 ? corruptedVisualText : originalText}
          </div>

          {showResult ? (
            <div className="animate-fadeIn">
              <div className={`alert-box ${noiseBit !== -1 ? 'alert-error' : 'alert-success'}`}>
                {noiseBit !== -1 ? (
                  <div>
                    <p className="font-bold">¡Síndrome Distinto de Cero!</p>
                    <p>Se detectó y corrigió automáticamente un error en el bit de transmisión #{detectedErrorBitGlobal + 1}.</p>
                  </div>
                ) : (
                  <p className="font-bold">Síndrome = [0,0,0]. ¡Transmisión limpia!</p>
                )}
              </div>

              <div className="result-container">
                <span className="result-title">Texto Decodificado y Corregido:</span>
                <p className="result-text">{finalRecoveredText}</p>
              </div>
            </div>
          ) : (
            <div className="placeholder-text">
              Esperando el envío de datos desde el canal...
            </div>
          )}
        </div>

      </div>
    </div>
  );
}