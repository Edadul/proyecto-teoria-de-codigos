import { useState, useMemo, useEffect } from 'react'
import './App.css'

// --- MATRIX CONFIGURATION (Hamming Theory [7,4,3]) ---
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

// --- UTILITY CONVERSION FUNCTIONS ---
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
  const [noiseBits, setNoiseBits] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);

  // --- ENCODING LOGIC ---
  const originalBits = useMemo(() => stringToBits(originalText), [originalText]);

  // Split into 4-bit blocks and encode into 7-bit blocks
  const encodedStream = useMemo(() => {
    const stream: number[] = [];
    for (let i = 0; i < originalBits.length; i += 4) {
      let block = originalBits.slice(i, i + 4);
      while (block.length < 4) block.push(0); // Padding if not a multiple of 4

      // Matrix multiplication: block * G mod 2
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

  // Seed distributed automatic noises when the text changes (max 1 noise per block to keep it correctable)
  useEffect(() => {
    if (encodedStream.length > 0) {
      const seededNoises: number[] = [];
      // Introduces a random noise every 2 blocks (14 bits) to simulate a noisy but safe channel
      for (let b = 0; b < encodedStream.length; b += 14) {
        const randomBlockIndex = b + Math.floor(Math.random() * 7);
        if (randomBlockIndex < encodedStream.length) {
          seededNoises.push(randomBlockIndex);
        }
      }
      setNoiseBits(seededNoises);
    } else {
      setNoiseBits([]);
    }
    setShowResult(false);
  }, [encodedStream]);

  // Handle manual grid clicks to inject/remove custom noise bits
  const toggleNoiseBit = (index: number) => {
    setShowResult(false);
    if (noiseBits.includes(index)) {
      setNoiseBits(noiseBits.filter(i => i !== index));
    } else {
      setNoiseBits([...noiseBits, index]);
    }
  };

  // --- CHANNEL LOGIC (MULTIPLE NOISE INJECTION) ---
  let receivedStream = [...encodedStream];
  noiseBits.forEach(bitIndex => {
    if (bitIndex >= 0 && bitIndex < receivedStream.length) {
      receivedStream[bitIndex] = receivedStream[bitIndex] === 1 ? 0 : 1; // Bit flip
    }
  });

  // Convert the noisy 7-bit stream directly to text for immediate visual corruption
  let corruptedBinaryText = [];
  for (let i = 0; i < receivedStream.length; i += 7) {
    corruptedBinaryText.push(...receivedStream.slice(i, i + 4));
  }
  const corruptedVisualText = bitsToString(corruptedBinaryText);

  // --- DECODING AND CORRECTION LOGIC (RECEIVER) ---
  let correctedStream = [];
  let totalErrorsCorrected = 0;
  let destroyedBlocksCount = 0;

  for (let b = 0; b < receivedStream.length; b += 7) {
    let block7 = receivedStream.slice(b, b + 7);

    // Count how many errors the channel introduced in THIS specific 7-bit block
    const noisesInThisBlock = noiseBits.filter(i => i >= b && i < b + 7).length;

    // Calculate Syndrome: S = block7 * H^T mod 2
    let syndrome = Array(3).fill(0);
    for (let rowH = 0; rowH < 3; rowH++) {
      let sum = 0;
      for (let c = 0; c < 7; c++) {
        sum += block7[c] * H[rowH][c];
      }
      syndrome[rowH] = sum % 2;
    }

    const hasError = syndrome.some(val => val !== 0);
    if (hasError) {
      if (noisesInThisBlock > 1) {
        // Geometric constraint: More than 1 error per block misleads the syndrome decoding
        destroyedBlocksCount++;
      }

      for (let col = 0; col < 7; col++) {
        let matches = true;
        for (let row = 0; row < 3; row++) {
          if (H[row][col] !== syndrome[row]) matches = false;
        }
        if (matches) {
          block7[col] = block7[col] === 1 ? 0 : 1; // Error Correction!
          totalErrorsCorrected++;
          break;
        }
      }
    }
    // Extract only the original 4 data bits (discard parity bits)
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
        
        {/* COLUMN 1: TRANSMITTER (EMISOR) */}
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

        {/* COLUMN 2: THE CANAL (NOISE CONTROL) */}
        <div className="card card-flex">
          <div>
            <div className="card-header">
              <span className="badge badge-canal">MEDIO</span>
              <h2 className="card-title">Canal de Transmisión</h2>
            </div>
            <p className="label-text">
              Simula la interferencia. <b>Haz click en varios bits</b> para activar/desactivar ruidos simultáneos:
            </p>
            
            {encodedStream.length > 0 ? (
              <div className="bits-grid">
                {encodedStream.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => toggleNoiseBit(index)}
                    className={`bit-button ${noiseBits.includes(index) ? 'error' : ''}`}
                    title={`Bit index: ${index}`}
                  >
                    {receivedStream[index]}
                  </button>
                ))}
              </div>
            ) : <p className="text-xs text-red-400">Introduce texto para generar bits.</p>}
          </div>

          <div className="mt-4">
            <button
              onClick={() => { setNoiseBits([]); setShowResult(false); }}
              className="btn-clear"
            >
              Limpiar Todo el Ruido
            </button>
            <button
              onClick={() => setShowResult(true)}
              className="btn-send"
            >
              Enviar al Receptor
            </button>
          </div>
        </div>

        {/* COLUMN 3: RECEIVER (RECEPTOR) */}
        <div className="card">
          <div className="card-header">
            <span className="badge badge-receptor">USUARIO 2</span>
            <h2 className="card-title">Receptor</h2>
          </div>

          <label className="label-text">Mensaje recibido (en tránsito ruidoso):</label>
          <div className="receptor-screen">
            {noiseBits.length > 0 ? corruptedVisualText : originalText}
          </div>

          {showResult ? (
            <div className="animate-fadeIn">
              <div className={`alert-box ${
                destroyedBlocksCount > 0 ? 'alert-error' : 'alert-success'
              }`} style={{ borderColor: destroyedBlocksCount > 0 ? '#991b1b' : '#065f46' }}>
                
                {noiseBits.length > 0 ? (
                  <div>
                    <p className="font-bold">📡 Análisis del Flujo de Datos:</p>
                    <p>Se procesaron los síndromes algebraicos de cada bloque lineal:</p>
                    <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
                      <li>Total de ruidos corregidos: <b>{totalErrorsCorrected}</b></li>
                      {destroyedBlocksCount > 0 && (
                        <li style={{ color: '#fca5a5', fontWeight: 'bold' }}>
                          ⚠️ Bloques destruídos (&gt;1 error): {destroyedBlocksCount}
                        </li>
                      )}
                    </ul>
                  </div>
                ) : (
                  <p className="font-bold">Síndrome general = [0,0,0]. ¡Transmisión limpia!</p>
                )}
              </div>

              <div className="result-container">
                <span className="result-title">Texto Decodificado y Corregido:</span>
                <p className="result-text">{finalRecoveredText}</p>
                {destroyedBlocksCount > 0 && (
                  <span style={{ fontSize: '11px', color: '#f87171', display: 'block', marginTop: '5px' }}>
                    * Nota: Algunos caracteres fallaron porque superaste la capacidad del código (más de 1 ruido por bloque).
                  </span>
                )}
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