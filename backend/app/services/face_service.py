"""
Face Recognition Service
========================
Übernommen aus dem bestehenden AEOS Face-ID Bridge Projekt.
Nutzt face_recognition (dlib) für 128-dimensionale Vektoren.
Keine GPU erforderlich - HOG-Modell für schnelle Erkennung.
"""

import face_recognition
import numpy as np
from typing import Optional, List, Dict
import io
import logging
import cv2
from skimage import exposure

logger = logging.getLogger(__name__)


class FaceService:
    """Face Recognition Service mit Multi-Vektor-Unterstützung"""

    @staticmethod
    def preprocess_image(image: np.ndarray) -> np.ndarray:
        """Normalisiert das Bild für bessere Gesichtserkennung"""
        try:
            # Konvertiere zu YUV für Histogram equalization
            image_yuv = cv2.cvtColor(image, cv2.COLOR_RGB2YUV)

            # Adaptive Histogram Equalization auf Y-Kanal (Luminanz)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            image_yuv[:, :, 0] = clahe.apply(image_yuv[:, :, 0])

            # Konvertiere zurück zu RGB
            processed = cv2.cvtColor(image_yuv, cv2.COLOR_YUV2RGB)

            # Gamma-Korrektur für bessere Kontrastverteilung
            processed = exposure.adjust_gamma(processed, gamma=1.2)

            logger.debug("Bildvorverarbeitung erfolgreich angewendet")
            return processed

        except Exception as e:
            logger.warning(f"Bildvorverarbeitung fehlgeschlagen: {e}")
            return image  # Fallback: Originalbild zurückgeben

    @staticmethod
    def extract_face_vector(image_data: bytes) -> Optional[List[float]]:
        """Extrahiert Gesichtsvektor aus Bilddaten mit optimierter Gesichtslokalisierung"""
        try:
            # Bild laden
            image = face_recognition.load_image_file(io.BytesIO(image_data))

            # Schritt 0: Bildvorverarbeitung (deaktiviert - verschlechtert Ergebnisse bei gut belichteten Bildern)
            # image = FaceService.preprocess_image(image)  # CLAHE + Gamma sind zu aggressiv

            # Schritt 1: Gesichter im Bild lokalisieren (HOG-Modell für Geschwindigkeit)
            # CNN würde genauer sein aber ist zu langsam für Docker-Umgebung
            face_locations = face_recognition.face_locations(image, model='hog')

            logger.debug(f"Gesichtserkennung (HOG): {len(face_locations)} Gesichter gefunden")
            logger.info("Optimierte Gesichtserkennung aktiv: Explizite Lokalisierung + HOG-Modell + verbesserte Logik")

            if not face_locations:
                logger.debug("Kein Gesicht im Bild erkannt")
                return None

            # Schritt 2: Nur die gefundenen Gesichtsregionen encodieren
            face_encodings = face_recognition.face_encodings(image, face_locations)

            if not face_encodings:
                logger.debug("Gesichtscodierung fehlgeschlagen trotz erkannter Gesichter")
                return None

            # Schritt 3: Das größte Gesicht auswählen (höchste Qualität)
            if len(face_encodings) > 1:
                # Berechne Gesichtsgrößen und wähle das größte aus
                face_sizes = []
                for loc in face_locations:
                    # loc = (top, right, bottom, left)
                    height = loc[2] - loc[0]  # bottom - top
                    width = loc[1] - loc[3]   # right - left
                    size = abs(height * width)
                    face_sizes.append(size)
                    logger.debug(f"Gesicht {len(face_sizes)}: Größe {height}x{width} = {size} Pixel")

                # Größtes Gesicht auswählen
                largest_face_index = face_sizes.index(max(face_sizes))
                selected_encoding = face_encodings[largest_face_index]
                logger.debug(f"Größtes Gesicht ausgewählt (Index {largest_face_index})")
            else:
                selected_encoding = face_encodings[0]
                logger.debug("Einzelnes Gesicht gefunden und ausgewählt")

            return selected_encoding.tolist()

        except Exception as e:
            logger.error(f"Error extracting face vector: {e}")
            return None

    @staticmethod
    def compare_faces(known_vector: List[float], unknown_vector: List[float]) -> float:
        """Vergleicht zwei Gesichtsvektoren und gibt Distanz zurück"""
        try:
            # Berechne euklidische Distanz
            distance = face_recognition.face_distance(
                [np.array(known_vector)],
                np.array(unknown_vector)
            )[0]
            return float(distance)
        except Exception as e:
            logger.error(f"Error comparing faces: {e}")
            return 1.0  # Hohe Distanz = keine Übereinstimmung

    @staticmethod
    def extract_multiple_face_vectors(image_data: bytes) -> Dict[str, List[float]]:
        """Extrahiert mehrere Vektor-Varianten aus einem Bild"""
        try:
            # Basis-Bild laden
            image = face_recognition.load_image_file(io.BytesIO(image_data))

            # Gesicht lokalisieren
            face_locations = face_recognition.face_locations(image, model='hog')
            if not face_locations:
                return {}

            # Größtes Gesicht auswählen
            largest_idx = FaceService._get_largest_face_index(face_locations)
            face_location = face_locations[largest_idx]

            vectors = {}

            # 1. Primary Vektor (Original)
            encodings = face_recognition.face_encodings(image, [face_location])
            if encodings:
                vectors['primary'] = encodings[0].tolist()

            # 2. Normalized Vektor (sanfte Normalisierung)
            normalized_image = FaceService._gentle_normalize(image)
            encodings = face_recognition.face_encodings(normalized_image, [face_location])
            if encodings:
                vectors['normalized'] = encodings[0].tolist()

            # 3. Grayscale Vektor
            gray_image = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
            gray_rgb = cv2.cvtColor(gray_image, cv2.COLOR_GRAY2RGB)
            encodings = face_recognition.face_encodings(gray_rgb, [face_location])
            if encodings:
                vectors['grayscale'] = encodings[0].tolist()

            logger.info(f"Mehrfach-Vektoren erstellt: {list(vectors.keys())}")
            return vectors

        except Exception as e:
            logger.error(f"Mehrfach-Vektor-Extraktion fehlgeschlagen: {e}")
            return {}

    @staticmethod
    def _gentle_normalize(image: np.ndarray) -> np.ndarray:
        """Sanfte Normalisierung ohne CLAHE-Overkill"""
        try:
            # Einfache Histogram-Stretching statt CLAHE
            image_yuv = cv2.cvtColor(image, cv2.COLOR_RGB2YUV)

            # Sanfte Kontrastverbesserung
            y_channel = image_yuv[:, :, 0]
            y_channel = cv2.normalize(y_channel, None, 0, 255, cv2.NORM_MINMAX)

            image_yuv[:, :, 0] = y_channel
            return cv2.cvtColor(image_yuv, cv2.COLOR_YUV2RGB)

        except Exception as e:
            logger.warning(f"Sanfte Normalisierung fehlgeschlagen: {e}")
            return image

    @staticmethod
    def _get_largest_face_index(face_locations) -> int:
        """Findet Index des größten Gesichts"""
        if len(face_locations) == 1:
            return 0

        max_area = 0
        max_idx = 0

        for i, (top, right, bottom, left) in enumerate(face_locations):
            area = (bottom - top) * (right - left)
            if area > max_area:
                max_area = area
                max_idx = i

        return max_idx

    @staticmethod
    def calculate_confidence(distance: float) -> float:
        """
        Berechnet Confidence-Score aus Distanz.

        Formel: (1 - min(distance, 0.8)) * 100

        - distance 0.0 -> 100% confidence
        - distance 0.4 -> 60% confidence
        - distance 0.6 -> 40% confidence
        - distance 0.8+ -> 20% confidence
        """
        return round((1 - min(distance, 0.8)) * 100, 2)

    @staticmethod
    def is_match(distance: float, threshold: float = 0.6) -> bool:
        """
        Prüft ob Distanz einen Match darstellt.

        Standard-Threshold: 0.6 (entspricht 40% Confidence)
        Empfohlen: 0.4-0.5 für höhere Genauigkeit
        """
        return distance <= threshold
