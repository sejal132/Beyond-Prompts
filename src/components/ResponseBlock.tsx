import { useRef, useState } from "react";
import { usePinch } from "@use-gesture/react";

interface ResponseBlockProps {
  text: string;
}

function ResponseBlock({ text }: ResponseBlockProps) {
  const [gesture, setGesture] = useState("No gesture detected");

  // Stores the scale when a pinch gesture begins
  const startScale = useRef(1);

  const bind = usePinch(
    ({ first, last, offset: [scale] }) => {
      // When the pinch starts, remember the starting scale
      if (first) {
        startScale.current = scale;
        setGesture("Pinching...");
      }

      // When the fingers are released, determine the direction
      if (last) {
        const change = scale / startScale.current;

        // Fingers moved apart by at least 15%
        if (change > 1.15) {
          setGesture("PINCH OUT → Expand");
        }

        // Fingers moved together by at least 15%
        else if (change < 0.85) {
          setGesture("PINCH IN → Condense");
        }

        // Movement wasn't large enough
        else {
          setGesture("Gesture too small");
        }
      }
    },
    {
      scaleBounds: {
        min: 0.5,
        max: 2,
      },
    }
  );

  return (
    <>
      <div
        {...bind()}
        className="response-block"
        style={{ touchAction: "none" }}
      >
        {text}
      </div>

      <p className="gesture-status">
        {gesture}
      </p>
    </>
  );
}

export default ResponseBlock;