"""
Vision Engine Service
Handles image analysis using Groq's Qwen 3.8 multimodal model.
"""
import base64
import logging
from typing import Optional, Union, BinaryIO
from groq import Groq
from app.core.config import settings

logger = logging.getLogger(__name__)

class VisionEngine:
    def __init__(self):
        self.client = Groq(api_key=settings.GROQ_API_KEY)
        # Qwen 3.8 (multimodal) - llama-4-scout was retired by Groq
        self.model = "qwen/qwen3.8-27b"

    def analyze_image(self, image_bytes: bytes, prompt: str = "") -> str:
        """
        Analyze an image with a specific prompt.
        
        Args:
            image_bytes: Raw bytes of the image (PNG/JPEG)
            prompt: Optional specific instruction
            
        Returns:
            Analysis text from the Vision Model
        """
        try:
            # Encode image to base64
            base64_image = base64.b64encode(image_bytes).decode('utf-8')
            
            if not prompt:
                # Default architectural prompt
                prompt = (
                    "You are an expert Architect reviewing a floor plan. "
                    "Analyze this image for compliance with building codes (like PD 1096 and RA 9514). "
                    "Identify rooms, potential safety issues, and layout efficiency. "
                    "Be professional, concise, and constructive."
                )

            if settings.DEBUG:
                logger.info(f"Sending image to Vision Model: {self.model}")

            chat_completion = self.client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{base64_image}",
                                },
                            },
                        ],
                    }
                ],
                model=self.model,
                temperature=0.3,
                max_tokens=1024,
            )

            return chat_completion.choices[0].message.content

        except Exception as e:
            logger.error(f"Vision analysis failed: {str(e)}")
            return f"Error analyzing image: {str(e)}"

# Global instance
vision_engine = VisionEngine()
