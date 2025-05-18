// strategy/fileManager.js
import fs from 'fs/promises';
import path from 'path';
import { watch } from 'fs';
import chalk from 'chalk';
import { FILE_MANAGER_CONFIG } from './configStrategy.js';

// Funzione per creare la cartella se non esiste
async function ensureDirectory(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
        console.log(chalk.green(`Cartella creata: ${dirPath}`));
    } catch (error) {
        if (error.code !== 'EEXIST') {
            console.error(chalk.red(`Errore nella creazione della cartella ${dirPath}: ${error.message}`));
            throw error;
        }
    }
}

// Funzione per copiare il file
async function copyCandleFile() {
    const sourcePath = path.resolve(FILE_MANAGER_CONFIG.sourceCandleFile);
    const targetPath = path.resolve(FILE_MANAGER_CONFIG.targetDataDir, FILE_MANAGER_CONFIG.targetCandleFile);

    try {
        await fs.copyFile(sourcePath, targetPath);
        console.log(chalk.blue(`File copiato: ${sourcePath} -> ${targetPath}`));
    } catch (error) {
        console.error(chalk.red(`Errore nella copia del file: ${error.message}`));
        throw error;
    }
}

// Funzione principale per inizializzare il file manager
export async function initializeFileManager() {
    const sourcePath = path.resolve(FILE_MANAGER_CONFIG.sourceCandleFile);
    const targetDir = path.resolve(FILE_MANAGER_CONFIG.targetDataDir);

    // Verifica se il file sorgente esiste
    try {
        await fs.access(sourcePath);
        console.log(chalk.green(`File trovato: ${sourcePath}`));
    } catch (error) {
        console.log(chalk.yellow(`File ${sourcePath} non trovato. Monitoraggio avviato...`));
        // Avvia il monitoraggio per la creazione del file
        const sourceDir = path.dirname(sourcePath);
        watch(sourceDir, async (eventType, filename) => {
            if (filename === path.basename(sourcePath) && eventType === 'change') {
                console.log(chalk.green(`File ${sourcePath} creato o modificato!`));
                await ensureDirectory(targetDir);
                await copyCandleFile();
            }
        });
        return; // Esce in attesa della creazione del file
    }

    // Crea la cartella di destinazione
    await ensureDirectory(targetDir);

    // Cancella tutti i file nella cartella targetDir
    const files = await fs.readdir(targetDir);
    for (const file of files) {
        await fs.rm(path.join(targetDir, file), { recursive: true, force: true });
    }

    // Copia iniziale del file
    await copyCandleFile();

    // Monitora le modifiche al file sorgente
    watch(sourcePath, async (eventType) => {
        if (eventType === 'change') {
            console.log(chalk.blue(`Modifica rilevata in ${sourcePath}. Aggiornamento...`));
            await copyCandleFile();
        }
    });
}