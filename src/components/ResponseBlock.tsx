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

interface DeepDivePosition {
  top: number;
  left: number;
  placement: "above" | "below";
}

function ResponseBlock({ text }: ResponseBlockProps) {
  const [displayedText, setDisplayedText] = useState(text);

  const [gesture, setGesture] = useState(
    "No gesture detected"
  );

  const [isTransforming, setIsTransforming] =
    useState(false);

  // --------------------------------------------------
  // Lasso
  // --------------------------------------------------

  const [selectedWordIndexes, setSelectedWordIndexes] =
    useState<number[]>([]);

  const [lassoPoints, setLassoPoints] =
    useState<Point[]>([]);

  const [isLassoing, setIsLassoing] =
    useState(false);

  // --------------------------------------------------
  // Deep Dive
  // --------------------------------------------------

  const [deepDiveText, setDeepDiveText] =
    useState("");

  const [isElaborating, setIsElaborating] =
    useState(false);

  const [deepDivePosition, setDeepDivePosition] =
    useState<DeepDivePosition | null>(null);

  const [showDeepDive, setShowDeepDive] =
    useState(false);

  // --------------------------------------------------
  // Pinch refs
  // --------------------------------------------------

  const startDistance = useRef(0);
  const latestDistance = useRef(0);

  // --------------------------------------------------
  // Scrub refs
  // --------------------------------------------------

  const scrubDirection =
    useRef<"left" | "right" | null>(null);

  const scrubDirectionChanges =
    useRef(0);

  const scrubSegmentStartX =
    useRef(0);

  const scrubDetected =
    useRef(false);

  // --------------------------------------------------
  // DOM refs
  // --------------------------------------------------

  const responseRef =
    useRef<HTMLDivElement>(null);

  const wordRefs =
    useRef<(HTMLSpanElement | null)[]>([]);

  // --------------------------------------------------
  // Reset when a new response arrives
  // --------------------------------------------------

  useEffect(() => {
    setDisplayedText(text);

    setLassoPoints([]);
    setSelectedWordIndexes([]);

    setDeepDiveText("");
    setDeepDivePosition(null);
    setShowDeepDive(false);

    setIsLassoing(false);
    setIsElaborating(false);

    scrubDirection.current = null;
    scrubDirectionChanges.current = 0;
    scrubDetected.current = false;
  }, [text]);

  // --------------------------------------------------
  // Words
  // --------------------------------------------------

  const words =
    displayedText.split(/\s+/);

  // --------------------------------------------------
  // Close Deep Dive
  // --------------------------------------------------

  const closeDeepDive = () => {
    setShowDeepDive(false);
    setDeepDiveText("");
    setDeepDivePosition(null);
    setSelectedWordIndexes([]);

    setGesture(
      "Deep Dive closed"
    );
  };

  // --------------------------------------------------
  // Deep Dive position
  // --------------------------------------------------

  const calculateDeepDivePosition = (
    indexes: number[]
  ) => {
    if (
      !responseRef.current ||
      indexes.length === 0
    ) {
      return null;
    }

    const responseRect =
      responseRef.current.getBoundingClientRect();

    const selectedRects = indexes
      .map((index) =>
        wordRefs.current[index]?.getBoundingClientRect()
      )
      .filter(
        (rect): rect is DOMRect =>
          rect !== undefined
      );

    if (selectedRects.length === 0) {
      return null;
    }

    const selectionLeft = Math.min(
      ...selectedRects.map((rect) => rect.left)
    );

    const selectionRight = Math.max(
      ...selectedRects.map((rect) => rect.right)
    );

    const selectionTop = Math.min(
      ...selectedRects.map((rect) => rect.top)
    );

    const selectionBottom = Math.max(
      ...selectedRects.map((rect) => rect.bottom)
    );

    const CARD_WIDTH = 300;
    const CARD_HEIGHT = 230;
    const GAP = 12;

    const selectionCenter =
      (selectionLeft + selectionRight) / 2;

    let left =
      selectionCenter -
      responseRect.left -
      CARD_WIDTH / 2;

    const MIN_LEFT = 8;

    const MAX_LEFT = Math.max(
      8,
      responseRect.width -
        CARD_WIDTH -
        8
    );

    left = Math.max(
      MIN_LEFT,
      Math.min(left, MAX_LEFT)
    );

    const spaceBelow =
      window.innerHeight -
      selectionBottom;

    const spaceAbove =
      selectionTop;

    let top: number;

    let placement:
      | "above"
      | "below";

    if (
      spaceBelow >= CARD_HEIGHT + GAP ||
      spaceBelow >= spaceAbove
    ) {
      top =
        selectionBottom -
        responseRect.top +
        GAP;

      placement = "below";
    } else {
      top =
        selectionTop -
        responseRect.top -
        CARD_HEIGHT -
        GAP;

      placement = "above";

      top = Math.max(
        8,
        top
      );
    }

    return {
      top,
      left,
      placement,
    };
  };

  // --------------------------------------------------
  // Pinch transformation
  // --------------------------------------------------

  const transformText = async (
    action: TransformAction
  ) => {
    if (
      isTransforming ||
      isElaborating
    ) {
      return;
    }

    try {
      setIsTransforming(true);

      setShowDeepDive(false);
      setDeepDiveText("");
      setDeepDivePosition(null);
      setSelectedWordIndexes([]);
      setLassoPoints([]);

      if (action === "condense") {
        setGesture(
          "Condensing..."
        );
      } else {
        setGesture(
          "Expanding..."
        );
      }

      const result = await fetch(
        "/api/transform",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            text: displayedText,
            action,
          }),
        }
      );

      if (!result.ok) {
        throw new Error(
          "Failed to transform text"
        );
      }

      const data =
        await result.json();

      setDisplayedText(
        data.text
      );

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
  // Elaborate
  // --------------------------------------------------

  const elaborateSelection = async (
    indexes: number[]
  ) => {
    if (
      indexes.length === 0 ||
      isElaborating
    ) {
      return;
    }

    const selectedText =
      indexes
        .map((index) => words[index])
        .join(" ");

    try {
      setIsElaborating(true);

      setDeepDiveText("");

      const position =
        calculateDeepDivePosition(
          indexes
        );

      setDeepDivePosition(
        position
      );

      setShowDeepDive(true);

      setGesture(
        "Exploring..."
      );

      const result = await fetch(
        "/api/elaborate",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            selectedText,
            context: displayedText,
          }),
        }
      );

      if (!result.ok) {
        throw new Error(
          "Failed to elaborate"
        );
      }

      const data =
        await result.json();

      setDeepDiveText(
        data.text
      );

      setGesture(
        "Deep Dive ready"
      );
    } catch (error) {
      console.error(
        "Elaboration error:",
        error
      );

      setDeepDiveText(
        "Unable to load this explanation."
      );

      setGesture(
        "Deep Dive failed"
      );
    } finally {
      setIsElaborating(false);
    }
  };

  // --------------------------------------------------
  // Rewrite response after scrub
  // --------------------------------------------------

  const rewriteText = async () => {
    if (
      isTransforming ||
      isElaborating
    ) {
      return;
    }

    try {
      setIsTransforming(true);

      // Rewrite replaces the whole response,
      // so close any existing Deep Dive.
      setShowDeepDive(false);
      setDeepDiveText("");
      setDeepDivePosition(null);
      setSelectedWordIndexes([]);
      setLassoPoints([]);

      setGesture(
        "Rewriting..."
      );

      const result = await fetch(
        "/api/rewrite",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            text: displayedText,
          }),
        }
      );

      if (!result.ok) {
        throw new Error(
          "Failed to rewrite text"
        );
      }

      const data =
        await result.json();

      setDisplayedText(
        data.text
      );

      setGesture(
        "SCRUB → Rewritten"
      );
    } catch (error) {
      console.error(
        "Rewrite error:",
        error
      );

      setGesture(
        "Rewrite failed"
      );
    } finally {
      setIsTransforming(false);
    }
  };

  // --------------------------------------------------
  // Pinch detection
  // --------------------------------------------------

  const bindPinch =
    usePinch(
      ({
        first,
        last,
        da: [distance],
      }) => {
        if (
          isTransforming ||
          isElaborating
        ) {
          return;
        }

        if (first) {
          setIsLassoing(false);
          setLassoPoints([]);

          scrubDetected.current =
            false;

          startDistance.current =
            distance;

          latestDistance.current =
            distance;

          setGesture(
            "Pinching..."
          );

          return;
        }

        if (!last) {
          latestDistance.current =
            distance;

          return;
        }

        const start =
          startDistance.current;

        const end =
          latestDistance.current;

        if (start === 0) {
          return;
        }

        const ratio =
          end / start;

        if (ratio > 1.15) {
          transformText(
            "expand"
          );
        } else if (
          ratio < 0.85
        ) {
          transformText(
            "condense"
          );
        }
      }
    );

  // --------------------------------------------------
  // Coordinates
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
      x:
        touch.clientX -
        rect.left,

      y:
        touch.clientY -
        rect.top,
    };
  };

  // --------------------------------------------------
  // Distance
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
  // Closed lasso
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
      points[
        points.length - 1
      ];

    const closingDistance =
      getDistance(
        firstPoint,
        lastPoint
      );

    return (
      closingDistance <= 50
    );
  };

  // --------------------------------------------------
  // Point inside polygon
  // --------------------------------------------------

  const isPointInsidePolygon = (
    point: Point,
    polygon: Point[]
  ) => {
    let inside = false;

    const { x, y } =
      point;

    for (
      let i = 0,
        j =
          polygon.length - 1;
      i < polygon.length;
      j = i++
    ) {
      const xi =
        polygon[i].x;

      const yi =
        polygon[i].y;

      const xj =
        polygon[j].x;

      const yj =
        polygon[j].y;

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
  // Words inside lasso
  // --------------------------------------------------

  const findWordsInsideLasso = (
    polygon: Point[]
  ) => {
    if (!responseRef.current) {
      return [];
    }

    const responseRect =
      responseRef.current.getBoundingClientRect();

    const selectedIndexes:
      number[] = [];

    wordRefs.current.forEach(
      (
        wordElement,
        index
      ) => {
        if (!wordElement) {
          return;
        }

        const wordRect =
          wordElement.getBoundingClientRect();

        const centerX =
          wordRect.left +
          wordRect.width / 2 -
          responseRect.left;

        const centerY =
          wordRect.top +
          wordRect.height / 2 -
          responseRect.top;

        if (
          isPointInsidePolygon(
            {
              x: centerX,
              y: centerY,
            },
            polygon
          )
        ) {
          selectedIndexes.push(
            index
          );
        }
      }
    );

    return selectedIndexes;
  };

  // --------------------------------------------------
  // Scrub detection
  // --------------------------------------------------

  const updateScrubDetection = (
    point: Point
  ) => {
    const MIN_SEGMENT_DISTANCE =
      35;

    const dx =
      point.x -
      scrubSegmentStartX.current;

    if (
      Math.abs(dx) <
      MIN_SEGMENT_DISTANCE
    ) {
      return;
    }

    const newDirection:
      | "left"
      | "right" =
      dx > 0
        ? "right"
        : "left";

    // First meaningful movement
    // establishes initial direction.
    if (
      scrubDirection.current ===
      null
    ) {
      scrubDirection.current =
        newDirection;

      scrubSegmentStartX.current =
        point.x;

      return;
    }

    // Continue travelling in same direction.
    if (
      newDirection ===
      scrubDirection.current
    ) {
      return;
    }

    // Direction reversed.
    scrubDirectionChanges.current +=
      1;

    scrubDirection.current =
      newDirection;

    scrubSegmentStartX.current =
      point.x;

    // Three reversals = scrub.
    if (
      scrubDirectionChanges.current >=
      3
    ) {
      scrubDetected.current =
        true;

      setIsLassoing(false);
      setLassoPoints([]);

      // Perform the actual rewrite.
      rewriteText();
    }
  };

  // --------------------------------------------------
  // Touch start
  // --------------------------------------------------

  const handleTouchStart = (
    event:
      React.TouchEvent<HTMLDivElement>
  ) => {
    // More than one finger means pinch.
    if (
      event.touches.length >
      1
    ) {
      setIsLassoing(false);
      setLassoPoints([]);

      return;
    }

    if (
      isTransforming ||
      isElaborating
    ) {
      return;
    }

    const point =
      getRelativePoint(
        event.touches[0]
      );

    if (!point) {
      return;
    }

    // Reset scrub detector.
    scrubDirection.current =
      null;

    scrubDirectionChanges.current =
      0;

    scrubSegmentStartX.current =
      point.x;

    scrubDetected.current =
      false;

    // Starting a new gesture closes
    // an existing Deep Dive.
    setShowDeepDive(false);
    setDeepDiveText("");
    setDeepDivePosition(null);
    setSelectedWordIndexes([]);

    setIsLassoing(true);

    setLassoPoints([
      point
    ]);

    setGesture(
      "Drawing..."
    );
  };

  // --------------------------------------------------
  // Touch move
  // --------------------------------------------------

  const handleTouchMove = (
    event:
      React.TouchEvent<HTMLDivElement>
  ) => {
    if (
      event.touches.length >
      1
    ) {
      setIsLassoing(false);
      setLassoPoints([]);

      return;
    }

    if (
      scrubDetected.current
    ) {
      return;
    }

    const point =
      getRelativePoint(
        event.touches[0]
      );

    if (!point) {
      return;
    }

    // Check scrub before treating
    // movement as lasso.
    updateScrubDetection(
      point
    );

    if (
      scrubDetected.current
    ) {
      return;
    }

    if (isLassoing) {
      setLassoPoints(
        (currentPoints) => [
          ...currentPoints,
          point,
        ]
      );
    }
  };

  // --------------------------------------------------
  // Touch end
  // --------------------------------------------------

  const handleTouchEnd =
    () => {
      // Scrub already won gesture classification.
      if (
        scrubDetected.current
      ) {
        setIsLassoing(false);
        setLassoPoints([]);

        return;
      }

      if (!isLassoing) {
        return;
      }

      setIsLassoing(false);

      if (
        lassoPoints.length <
        10
      ) {
        setLassoPoints([]);

        setGesture(
          "Gesture not recognized"
        );

        return;
      }

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

      const selectedIndexes =
        findWordsInsideLasso(
          lassoPoints
        );

      if (
        selectedIndexes.length ===
        0
      ) {
        setGesture(
          "No text selected"
        );

        setLassoPoints([]);

        return;
      }

      setSelectedWordIndexes(
        selectedIndexes
      );

      setLassoPoints([]);

      elaborateSelection(
        selectedIndexes
      );
    };

  // --------------------------------------------------
  // Lasso SVG path
  // --------------------------------------------------

  const createLassoPath =
    () => {
      if (
        lassoPoints.length ===
        0
      ) {
        return "";
      }

      const firstPoint =
        lassoPoints[0];

      let path =
        `M ${firstPoint.x} ${firstPoint.y}`;

      for (
        let i = 1;
        i <
        lassoPoints.length;
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

        {/* Lasso drawing */}

        {lassoPoints.length >
          0 && (
          <svg
            className="lasso-overlay"
          >
            <path
              d={
                createLassoPath()
              }
              className="lasso-path"
            />
          </svg>
        )}

        {/* Floating Deep Dive */}

        {showDeepDive &&
          deepDivePosition && (
            <div
              className={`deep-dive-popover ${deepDivePosition.placement}`}
              style={{
                top:
                  deepDivePosition.top,

                left:
                  deepDivePosition.left,
              }}
              onTouchStart={(
                event
              ) => {
                event.stopPropagation();
              }}
            >
              <div className="deep-dive-header">
                <span className="deep-dive-title">
                  Deep Dive
                </span>

                <button
                  className="deep-dive-close"
                  onClick={
                    closeDeepDive
                  }
                  aria-label="Close Deep Dive"
                >
                  ×
                </button>
              </div>

              <div className="deep-dive-content">
                {isElaborating ? (
                  <div className="deep-dive-loading">
                    Exploring...
                  </div>
                ) : (
                  <div className="deep-dive-text">
                    {
                      deepDiveText
                    }
                  </div>
                )}
              </div>
            </div>
          )}
      </div>

      <p className="gesture-status">
        {gesture}
      </p>
    </>
  );
}

export default ResponseBlock;