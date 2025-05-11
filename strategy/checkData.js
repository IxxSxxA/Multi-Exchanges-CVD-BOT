// ../strategy/checkData.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Ottieni __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const checkData = (sourceFile) => {
    const targetDir = path.resolve(__dirname, 'data');
    const targetFile = sourceFile; // Usa il file sorgente direttamente (già in data/)

    // Controlla se il file sorgente esiste
    if (!fs.existsSync(sourceFile)) {
        throw new Error(`File ${sourceFile} non trovato.`);
    }

    // Crea la directory di destinazione se non esiste
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    // Copia il file nella directory di destinazione (se necessario)
    if (sourceFile !== targetFile) {
        fs.copyFileSync(sourceFile, targetFile);
        console.log(`File copiato da ${sourceFile} a ${targetFile}`);
    }

    // Carica e restituisce i dati del file
    const candleData = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
    console.log(`Caricate ${candleData.length} candele dal file ${targetFile}`);
    
    return candleData;
};