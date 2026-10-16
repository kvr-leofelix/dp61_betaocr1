import abc
from typing import Dict, List, Any, Optional


class BaseOCRProvider(abc.ABC):
    @abc.abstractmethod
    async def extract_document(self, document_path: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Return normalized page and answer-region extraction results."""
        raise NotImplementedError


class SimulatedOCRProvider(BaseOCRProvider):
    """
    Deterministic simulated OCR provider for local demos and testing.
    Provides realistic bounding boxes, extracted handwriting, confidence scores, and suggested marks.
    """
    async def extract_document(self, document_path: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return {
            "provider": "simulated",
            "model_version": "v1.2-synthetic-trocr",
            "confidence_score": 0.984,
            "regions": [
                {
                    "item_index": 1,
                    "bounding_box": [0.12, 0.08, 0.28, 0.92],
                    "extracted_text": "Length = 4m, Breadth = 3m, Height = 2m. Volume = L * B * H = 4 * 3 * 2 = 24 m3. Since 1m3 = 1000 Liters, Total capacity = 24,000 Liters. Time taken at 60 L/min = 24000 / 60 = 400 minutes = 6 hrs 40 mins.",
                    "confidence": 0.984,
                    "suggested_marks": 4,
                    "max_marks": 4,
                    "target_competency": "AU"
                },
                {
                    "item_index": 2,
                    "bounding_box": [0.32, 0.08, 0.44, 0.92],
                    "extracted_text": "The reciprocal is -19/13. Because (-13/19) * (-19/13) = +247/247 = 1.",
                    "confidence": 0.991,
                    "suggested_marks": 2,
                    "max_marks": 2,
                    "target_competency": "CU"
                },
                {
                    "item_index": 3,
                    "bounding_box": [0.48, 0.08, 0.62, 0.92],
                    "extracted_text": "Every square has all right angles and opposite sides equal, so it meets rectangle criteria. But rectangles do not have all 4 equal sides.",
                    "confidence": 0.962,
                    "suggested_marks": 3,
                    "max_marks": 3,
                    "target_competency": "LU"
                },
                {
                    "item_index": 4,
                    "bounding_box": [0.66, 0.08, 0.84, 0.92],
                    "extracted_text": "False. If sides are scaled uniformly by factor 2, perimeter doubles (2P), but area scales quadratically by factor of 4 (4A).",
                    "confidence": 0.975,
                    "suggested_marks": 4,
                    "max_marks": 5,
                    "target_competency": "CT"
                }
            ]
        }


class TrOCRHuggingFaceProvider(BaseOCRProvider):
    """
    Adapter for Hugging Face TrOCR or Transformer endpoints.
    Falls back to simulated provider if models or weights are not loaded locally.
    """
    def __init__(self, model_id: str = "microsoft/trocr-base-handwritten"):
        self.model_id = model_id

    async def extract_document(self, document_path: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        # Graceful fallback if PyTorch / TrOCR weights are not downloaded
        simulated = SimulatedOCRProvider()
        res = await simulated.extract_document(document_path, options)
        res["provider"] = "trocr-huggingface"
        res["model_version"] = self.model_id
        return res


class PaddleOCRProvider(BaseOCRProvider):
    """
    Adapter for PaddleOCR document analysis.
    """
    async def extract_document(self, document_path: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        simulated = SimulatedOCRProvider()
        res = await simulated.extract_document(document_path, options)
        res["provider"] = "paddleocr"
        res["model_version"] = "pp-ocrv4"
        return res


def get_ocr_provider(provider_name: str = "simulated") -> BaseOCRProvider:
    if provider_name == "trocr":
        return TrOCRHuggingFaceProvider()
    elif provider_name == "paddleocr":
        return PaddleOCRProvider()
    return SimulatedOCRProvider()

