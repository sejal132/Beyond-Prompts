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

  // Stores the indexes of words selected by the lasso
  const [selectedWordIndexes, setSelectedWordIndexes] =
    useState<number[]>([]);

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

  // Store references to every rendered word
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // --------------------------------------------------
  // Reset when new response is generated
  // --------------------------------------------------

  useEffect(() => {
    setDisplayedText(text);
    setLassoPoints([]);
    setSelectedWordIndexes([]);
    setIsLassoing(false);
  }, [text]);

  // --------------------------------------------------
  // Split response into words
  // --------------------------------------------------

  const words = displayedText.split(/\s+/);

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

      setSelectedWordIndexes([]);
      setLassoPoints([]);

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
        setSelectedWordIndexes([]);

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
        setGesture(
          "Could not detect gesture"
        );
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
  // Convert finger coordinates to coordinates inside
  // the response block
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
  // Distance between two points
  // --------------------------------------------------

  const getDistance = (
    point1: Point,
    point2: Point
  ) => {
    const deltaX =
      point2.x - point1.x;

    const deltaY =
      point2.y - point1.y;

    return Math.sqrt(
      deltaX * deltaX +
      deltaY * deltaY
    );
  };

  // --------------------------------------------------
  // Check whether lasso is closed
  // --------------------------------------------------

  const isLassoClosed = (
    points: Point[]
  ) => {
    if (points.length < 10) {
      return false;
    }

    const firstPoint =
      points[0];

    const lastPoint =
      points[points.length - 1];

    const closingDistance =
      getDistance(
        firstPoint,
        lastPoint
      );

    const CLOSE_THRESHOLD = 50;

    return (
      closingDistance <=
      CLOSE_THRESHOLD
    );
  };

  // --------------------------------------------------
  // Point-in-polygon algorithm
  //
  // Determines whether a point is geometrically
  // inside the user's lasso.
  // --------------------------------------------------

  const isPointInsidePolygon = (
    point: Point,
    polygon: Point[]
  ) => {
    let inside = false;

    const { x, y } = point;

    for (
      let i = 0, j = polygon.length - 1;
      i < polygon.length;
      j = i++
    ) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;

      const xj = polygon[j].x;
      const yj = polygon[j].y;

      const intersects =
        yi > y !== yj > y &&
        x <
          ((xj - xi) *
            (y - yi)) /
            (yj - yi) +
            xi;

      if (intersects) {
        inside = !inside;
      }
    }

    return inside;
  };

  // --------------------------------------------------
  // Find words inside lasso
  // --------------------------------------------------

  const findWordsInsideLasso = (
    polygon: Point[]
  ) => {
    if (!responseRef.current) {
      return [];
    }

    const responseRect =
      responseRef.current.getBoundingClientRect();

    const selectedIndexes: number[] = [];

    wordRefs.current.forEach(
      (wordElement, index) => {
        if (!wordElement) {
          return;
        }

        const wordRect =
          wordElement.getBoundingClientRect();

        // Find the center of the word
        const centerX =
          wordRect.left +
          wordRect.width / 2 -
          responseRect.left;

        const centerY =
          wordRect.top +
          wordRect.height / 2 -
          responseRect.top;

        const wordCenter: Point = {
          x: centerX,
          y: centerY,
        };

        if (
          isPointInsidePolygon(
            wordCenter,
            polygon
          )
        ) {
          selectedIndexes.push(index);
        }
      }
    );

    return selectedIndexes;
  };

  // --------------------------------------------------
  // Touch start
  // --------------------------------------------------

  const handleTouchStart = (
    event: React.TouchEvent<HTMLDivElement>
  ) => {
    // More than one finger means pinch
    if (event.touches.length > 1) {
      setIsLassoing(false);
      setLassoPoints([]);
      return;
    }

    if (isTransforming) {
      return;
    }

    const point =
      getRelativePoint(
        event.touches[0]
      );

    if (!point) {
      return;
    }

    // Starting a new lasso clears
    // the previous selection
    setSelectedWordIndexes([]);

    setIsLassoing(true);

    setLassoPoints([
      point
    ]);

    setGesture(
      "Drawing lasso..."
    );
  };

  // --------------------------------------------------
  // Touch movement
  // --------------------------------------------------

  const handleTouchMove = (
    event: React.TouchEvent<HTMLDivElement>
  ) => {
    // If second finger appears,
    // cancel lasso and allow pinch.
    if (event.touches.length > 1) {
      setIsLassoing(false);
      setLassoPoints([]);
      return;
    }

    if (!isLassoing) {
      return;
    }

    const point =
      getRelativePoint(
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
  // Touch end
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

    // Loop wasn't closed
    if (
      !isLassoClosed(
        lassoPoints
      )
    ) {
      setGesture(
        "Lasso not closed"
      );

      setTimeout(() => {
        setLassoPoints([]);
      }, 500);

      return;
    }

    // ----------------------------------------------
    // Valid lasso:
    // determine which words are inside it.
    // ----------------------------------------------

    const selectedIndexes =
      findWordsInsideLasso(
        lassoPoints
      );

    if (
      selectedIndexes.length === 0
    ) {
      setGesture(
        "No text selected"
      );

      setTimeout(() => {
        setLassoPoints([]);
      }, 500);

      return;
    }

    setSelectedWordIndexes(
      selectedIndexes
    );

    setGesture(
      `${selectedIndexes.length} word${
        selectedIndexes.length === 1
          ? ""
          : "s"
      } selected`
    );

    // Once selection is known,
    // remove the hand-drawn lasso.
    setTimeout(() => {
      setLassoPoints([]);
    }, 300);
  };

  // --------------------------------------------------
  // Create SVG lasso path
  // --------------------------------------------------

  const createLassoPath = () => {
    if (
      lassoPoints.length === 0
    ) {
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

    if (
      !isLassoing &&
      isLassoClosed(
        lassoPoints
      )
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
          {words.map(
            (word, index) => (
              <span
                key={`${word}-${index}`}
                ref={(element) => {
                  wordRefs.current[
                    index
                  ] = element;
                }}
                className={
                  selectedWordIndexes.includes(
                    index
                  )
                    ? "selected-word"
                    : ""
                }
              >
                {word}
                {index <
                words.length - 1
                  ? " "
                  : ""}
              </span>
            )
          )}
        </div>

        {lassoPoints.length >
          0 && (
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