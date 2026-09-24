import { useRef, useState } from "react";
import { usePinch } from "@use-gesture/react";

interface ResponseBlockProps {
  text: string;
}

type DetailLevel = "short" | "normal" | "detailed";

function ResponseBlock({ text }: ResponseBlockProps) {
  const [gesture, setGesture] = useState("No gesture detected");
  const [detailLevel, setDetailLevel] =
    useState<DetailLevel>("normal");

  // Distance between fingers when the gesture starts
  const startDistance = useRef(0);

  // Latest distance while the fingers are moving
  const latestDistance = useRef(0);

  const shortText =
    "AI allows computers to perform tasks that normally require human intelligence.";

  const detailedText =
    "Artificial intelligence is a field of computer science focused on creating systems capable of performing tasks that normally require human intelligence. These tasks can include understanding natural language, recognizing patterns in data, generating text and images, making predictions, solving problems, and assisting people with complex decisions. Modern AI systems often learn patterns from large amounts of data and use those patterns to generate useful outputs for new inputs.";

  const getDisplayedText = () => {
    if (detailLevel === "short") {
      return shortText;
    }

    if (detailLevel === "detailed") {
      return detailedText;
    }

    return text;
  };

  const handlePinchIn = () => {
    setGesture("PINCH IN → Condense");

    setDetailLevel((current) => {
      if (current === "detailed") return "normal";
      if (current === "normal") return "short";

      return "short";
    });
  };

  const handlePinchOut = () => {
    setGesture("PINCH OUT → Expand");

    setDetailLevel((current) => {
      if (current === "short") return "normal";
      if (current === "normal") return "detailed";

      return "detailed";
    });
  };

  const bind = usePinch(({ first, last, da: [distance] }) => {
    // First event of a NEW pinch gesture
    if (first) {
      startDistance.current = distance;
      latestDistance.current = distance;

      setGesture("Pinching...");
      return;
    }

    // Continuously remember the current finger distance
    if (!last) {
      latestDistance.current = distance;
      return;
    }

    // Gesture has ended.
    // Compare the last known distance with the starting distance.
    const start = startDistance.current;
    const end = latestDistance.current;

    if (start === 0) {
      setGesture("Could not detect gesture");
      return;
    }

    const ratio = end / start;

    console.log("Start:", start);
    console.log("End:", end);
    console.log("Ratio:", ratio);

    if (ratio > 1.15) {
      handlePinchOut();
    } else if (ratio < 0.85) {
      handlePinchIn();
    } else {
      setGesture("Gesture too small");
    }
  });

  return (
    <>
      <div
        {...bind()}
        className="response-block"
        style={{ touchAction: "none" }}
      >
        {getDisplayedText()}
      </div>

      <p className="gesture-status">
        {gesture}
      </p>

      <p className="detail-level">
        Detail level: <strong>{detailLevel}</strong>
      </p>
    </>
  );
}

export default ResponseBlock;