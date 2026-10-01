import { useEffect, useRef, useState } from "react";
import { usePinch } from "@use-gesture/react";

interface ResponseBlockProps {
  text: string;
}

type TransformAction = "condense" | "expand";

interface Point {
  x: number;
  y: number;
}

function ResponseBlock({ text }: ResponseBlockProps) {
  const [displayedText, setDisplayedText] = useState(text);

  const [gesture, setGesture] = useState(
    "No gesture detected"
  );

  const [isTransforming, setIsTransforming] =
    useState(false);

  // --------------------------------------------------
  // Pinch refs
  // --------------------------------------------------

  const startDistance = useRef(0);
  const latestDistance = useRef(0);

  // --------------------------------------------------
  // Lasso state
  // --------------------------------------------------

  const [lassoPoints, setLassoPoints] = useState<Point[]>([]);
  const [isLassoing, setIsLassoing] = useState(false);

  const responseRef = useRef<HTMLDivElement>(null);

  // --------------------------------------------------
  // Reset when a new response is generated
  // --------------------------------------------------

  useEffect(() => {
    setDisplayedText(text);
    setLassoPoints([]);
    setIsLassoing(false);
  }, [text]);

  // --------------------------------------------------
  // LLM transformation
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
        setGesture("PINCH IN → Condensed");
      } else {
        setGesture("PINCH OUT → Expanded");
      }

      setLassoPoints([]);
    } catch (error) {
      console.error(
        "Transformation error:",
        error
      );

      setGesture("Transformation failed");
    } finally {
      setIsTransforming(false);
    }
  };

  // --------------------------------------------------
  // Pinch detection
  // --------------------------------------------------

  const bindPinch = usePinch(
    ({
      first,
      last,
      da: [distance],
    }) => {
      if (isTransforming) {
        return;
      }

      if (first) {
        // Pinch takes priority over lasso
        setIsLassoing(false);
        setLassoPoints([]);

        startDistance.current = distance;
        latestDistance.current = distance;

        setGesture("Pinching...");
        return;
      }

      if (!last) {
        latestDistance.current = distance;
        return;
      }

      const start = startDistance.current;
      const end = latestDistance.current;

      if (start === 0) {
        setGesture("Could not detect gesture");
        return;
      }

      const ratio = end / start;

      if (ratio > 1.15) {
        transformText("expand");
      } else if (ratio < 0.85) {
        transformText("condense");
      } else {
        setGesture("Gesture too small");
      }
    }
  );

  // --------------------------------------------------
  // Convert finger position into coordinates relative
  // to the response block
  // --------------------------------------------------

  const getRelativePoint = (
    touch: React.Touch
  ): Point | null => {
    if (!responseRef.current) {
      return null;
    }

    const rect =
      responseRef.current.getBoundingClientRect();

    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  };

  // --------------------------------------------------
  // Calculate distance between two points
  // --------------------------------------------------

  const getDistance = (
    point1: Point,
    point2: Point
  ) => {
    const deltaX = point2.x - point1.x;
    const deltaY = point2.y - point1.y;

    return Math.sqrt(
      deltaX * deltaX +
      deltaY * deltaY
    );
  };

  // --------------------------------------------------
  // Determine whether the lasso is closed
  // --------------------------------------------------

  const isLassoClosed = (
    points: Point[]
  ) => {
    if (points.length < 10) {
      return false;
    }

    const firstPoint = points[0];
    const lastPoint =
      points[points.length - 1];

    const closingDistance =
      getDistance(
        firstPoint,
        lastPoint
      );

    // Finger must finish within 50 pixels
    // of where the lasso started.
    const CLOSE_THRESHOLD = 50;

    return (
      closingDistance <=
      CLOSE_THRESHOLD
    );
  };

  // --------------------------------------------------
  // Lasso touch start
  // --------------------------------------------------

  const handleTouchStart = (
    event: React.TouchEvent<HTMLDivElement>
  ) => {
    // More than one finger means pinch.
    if (event.touches.length > 1) {
      setIsLassoing(false);
      setLassoPoints([]);
      return;
    }

    if (isTransforming) {
      return;
    }

    const point = getRelativePoint(
      event.touches[0]
    );

    if (!point) {
      return;
    }

    setIsLassoing(true);

    setLassoPoints([
      point
    ]);

    setGesture(
      "Drawing lasso..."
    );
  };

  // --------------------------------------------------
  // Lasso movement
  // --------------------------------------------------

  const handleTouchMove = (
    event: React.TouchEvent<HTMLDivElement>
  ) => {
    // Second finger appeared.
    // Cancel lasso so pinch can take over.
    if (event.touches.length > 1) {
      setIsLassoing(false);
      setLassoPoints([]);
      return;
    }

    if (!isLassoing) {
      return;
    }

    const point = getRelativePoint(
      event.touches[0]
    );

    if (!point) {
      return;
    }

    setLassoPoints(
      (currentPoints) => [
        ...currentPoints,
        point,
      ]
    );
  };

  // --------------------------------------------------
  // Lasso finger release
  // --------------------------------------------------

  const handleTouchEnd = () => {
    if (!isLassoing) {
      return;
    }

    setIsLassoing(false);

    // Too little movement
    if (lassoPoints.length < 10) {
      setLassoPoints([]);

      setGesture(
        "Lasso too small"
      );

      return;
    }

    // Check whether user actually returned
    // close to the starting position.
    if (!isLassoClosed(lassoPoints)) {
      setGesture(
        "Lasso not closed"
      );

      // Remove invalid stroke shortly after
      // the user releases their finger.
      setTimeout(() => {
        setLassoPoints([]);
      }, 500);

      return;
    }

    // Valid closed lasso
    setGesture(
      "Lasso drawn"
    );
  };

  // --------------------------------------------------
  // Convert points into SVG path
  // --------------------------------------------------

  const createLassoPath = () => {
    if (lassoPoints.length === 0) {
      return "";
    }

    const firstPoint =
      lassoPoints[0];

    let path =
      `M ${firstPoint.x} ${firstPoint.y}`;

    for (
      let i = 1;
      i < lassoPoints.length;
      i++
    ) {
      path +=
        ` L ${lassoPoints[i].x} ${lassoPoints[i].y}`;
    }

    // Only visually close the SVG path once
    // the user's gesture is actually closed.
    if (
      !isLassoing &&
      isLassoClosed(lassoPoints)
    ) {
      path += " Z";
    }

    return path;
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <>
      <div
        {...bindPinch()}
        ref={responseRef}
        className={`response-block ${
          isTransforming
            ? "transforming"
            : ""
        }`}
        style={{
          touchAction: "none",
        }}
        onTouchStart={
          handleTouchStart
        }
        onTouchMove={
          handleTouchMove
        }
        onTouchEnd={
          handleTouchEnd
        }
      >
        <div className="response-text">
          {displayedText}
        </div>

        {lassoPoints.length > 0 && (
          <svg
            className="lasso-overlay"
          >
            <path
              d={createLassoPath()}
              className="lasso-path"
            />
          </svg>
        )}
      </div>

      <p className="gesture-status">
        {gesture}
      </p>
    </>
  );
}

export default ResponseBlock;