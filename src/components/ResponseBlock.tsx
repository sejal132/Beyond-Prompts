import { useEffect, useRef, useState } from "react";
import { usePinch } from "@use-gesture/react";

interface ResponseBlockProps {
  text: string;
}

type TransformAction = "condense" | "expand";

function ResponseBlock({ text }: ResponseBlockProps) {
  const [displayedText, setDisplayedText] = useState(text);

  const [gesture, setGesture] = useState(
    "No gesture detected"
  );

  const [isTransforming, setIsTransforming] =
    useState(false);

  // Distance between fingers when pinch begins
  const startDistance = useRef(0);

  // Most recent distance between fingers
  const latestDistance = useRef(0);

  // If the user generates an entirely new response,
  // reset the displayed text.
  useEffect(() => {
    setDisplayedText(text);
  }, [text]);

  // --------------------------------------------------
  // Send current text to backend for transformation
  // --------------------------------------------------

  const transformText = async (
    action: TransformAction
  ) => {
    if (isTransforming) {
      return;
    }

    try {
      setIsTransforming(true);

      if (action === "condense") {
        setGesture("Condensing...");
      } else {
        setGesture("Expanding...");
      }

      const result = await fetch("/api/transform", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          text: displayedText,
          action: action,
        }),
      });

      if (!result.ok) {
        throw new Error(
          "Failed to transform text"
        );
      }

      const data = await result.json();

      setDisplayedText(data.text);

      if (action === "condense") {
        setGesture(
          "PINCH IN → Condensed"
        );
      } else {
        setGesture(
          "PINCH OUT → Expanded"
        );
      }
    } catch (error) {
      console.error(
        "Transformation error:",
        error
      );

      setGesture(
        "Transformation failed"
      );
    } finally {
      setIsTransforming(false);
    }
  };

  // --------------------------------------------------
  // Pinch gesture detection
  // --------------------------------------------------

  const bind = usePinch(
    ({
      first,
      last,
      da: [distance],
    }) => {
      // Ignore new gestures while the LLM
      // is already transforming the text.
      if (isTransforming) {
        return;
      }

      // Gesture begins
      if (first) {
        startDistance.current =
          distance;

        latestDistance.current =
          distance;

        setGesture("Pinching...");

        return;
      }

      // Gesture is still happening
      if (!last) {
        latestDistance.current =
          distance;

        return;
      }

      // Gesture ended
      const start =
        startDistance.current;

      const end =
        latestDistance.current;

      if (start === 0) {
        setGesture(
          "Could not detect gesture"
        );

        return;
      }

      const ratio = end / start;

      // Fingers moved apart
      if (ratio > 1.15) {
        transformText("expand");
      }

      // Fingers moved together
      else if (ratio < 0.85) {
        transformText("condense");
      }

      // Not enough movement
      else {
        setGesture(
          "Gesture too small"
        );
      }
    }
  );

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <>
      <div
        {...bind()}
        className={`response-block ${
          isTransforming
            ? "transforming"
            : ""
        }`}
        style={{
          touchAction: "none",
        }}
      >
        {displayedText}
      </div>

      <p className="gesture-status">
        {gesture}
      </p>
    </>
  );
}

export default ResponseBlock;