
import { analyzeImageWithVision } from "./openaiVision";

export async function runRecognitionPipeline(file: File) {

  const vision = await analyzeImageWithVision(file);

  return {
    title: vision.title,
    category: vision.category,
    estimatedValue: vision.estimatedValue,
    confidence: vision.confidence,
  };
}
