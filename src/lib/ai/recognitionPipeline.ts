
import { analyzeImageWithVision } from "./openaiVision";

export async function runRecognitionPipeline(file: File) {

  const vision = await analyzeImageWithVision(file);

  return {
    title: vision.detectedTitle,
    category: vision.detectedCategory,
    estimatedValue: vision.estimatedValue,
    confidence: vision.confidence,
  };
}
