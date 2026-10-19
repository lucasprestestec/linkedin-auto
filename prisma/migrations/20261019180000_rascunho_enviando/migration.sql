-- Rascunho reservado por um envio em andamento: nenhum outro robô o pega, nem depois de passado o prazo.
ALTER TYPE "DraftStatus" ADD VALUE IF NOT EXISTS 'SENDING';
