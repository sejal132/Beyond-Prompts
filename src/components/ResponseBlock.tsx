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
  // Lasso selection
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
  // Refs
  // --------------------------------------------------

  const startDistance = useRef(0);
  const latestDistance = useRef(0);

  const responseRef =
    useRef<HTMLDivElement>(null);

  const wordRefs =
    useRef<(HTMLSpanElement | null)[]>([]);

  // --------------------------------------------------
  // Reset when a completely new response arrives
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
  }, [text]);

  // --------------------------------------------------
  // Split response into words
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
  // Calculate position of Deep Dive card
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
      .map((index) => {
        return wordRefs.current[
          index
        ]?.getBoundingClientRect();
      })
      .filter(
        (
          rect
        ): rect is DOMRect =>
          rect !== undefined
      );

    if (
      selectedRects.length === 0
    ) {
      return null;
    }

    // Find bounding box surrounding all selected words
    const selectionLeft = Math.min(
      ...selectedRects.map(
        (rect) => rect.left
      )
    );

    const selectionRight = Math.max(
      ...selectedRects.map(
        (rect) => rect.right
      )
    );

    const selectionTop = Math.min(
      ...selectedRects.map(
        (rect) => rect.top
      )
    );

    const selectionBottom = Math.max(
      ...selectedRects.map(
        (rect) => rect.bottom
      )
    );

    // Approximate card dimensions
    const CARD_WIDTH = 300;
    const CARD_HEIGHT = 230;
    const GAP = 12;

    // ------------------------------------------------
    // Horizontal position
    // ------------------------------------------------

    const selectionCenter =
      (selectionLeft +
        selectionRight) /
      2;

    let left =
      selectionCenter -
      responseRect.left -
      CARD_WIDTH / 2;

    // Prevent card from leaving response horizontally
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

    // ------------------------------------------------
    // Decide whether card goes above or below
    // ------------------------------------------------

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
      spaceBelow >=
        CARD_HEIGHT + GAP ||
      spaceBelow >= spaceAbove
    ) {
      // Place underneath selected text
      top =
        selectionBottom -
        responseRect.top +
        GAP;

      placement = "below";
    } else {
      // Place above selected text
      top =
        selectionTop -
        responseRect.top -
        CARD_HEIGHT -
        GAP;

      placement = "above";

      // Keep it from going outside
      // the top of the response.
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

      // Pinching closes an existing Deep Dive.
      setShowDeepDive(false);
      setDeepDiveText("");
      setDeepDivePosition(null);
      setSelectedWordIndexes([]);
      setLassoPoints([]);

      if (
        action === "condense"
      ) {
        setGesture(
          "Condensing..."
        );
      } else {
        setGesture(
          "Expanding..."
        );
      }

      const result =
        await fetch(
          "/api/transform",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                text:
                  displayedText,

                action:
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

      if (
        action === "condense"
      ) {
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
      setIsTransforming(
        false
      );
    }
  };

  // --------------------------------------------------
  // Ask LLM to elaborate
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
        .map(
          (index) =>
            words[index]
        )
        .join(" ");

    try {
      setIsElaborating(
        true
      );

      setDeepDiveText("");

      // Calculate where the card should appear.
      const position =
        calculateDeepDivePosition(
          indexes
        );

      setDeepDivePosition(
        position
      );

      // Show card immediately so user gets
      // instant feedback while API is loading.
      setShowDeepDive(true);

      setGesture(
        "Exploring..."
      );

      const result =
        await fetch(
          "/api/elaborate",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                selectedText:
                  selectedText,

                context:
                  displayedText,
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
      setIsElaborating(
        false
      );
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
          setIsLassoing(
            false
          );

          setLassoPoints(
            []
          );

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
          setGesture(
            "Could not detect gesture"
          );

          return;
        }

        const ratio =
          end / start;

        if (
          ratio > 1.15
        ) {
          transformText(
            "expand"
          );
        } else if (
          ratio < 0.85
        ) {
          transformText(
            "condense"
          );
        } else {
          setGesture(
            "Gesture too small"
          );
        }
      }
    );

  // --------------------------------------------------
  // Finger coordinates relative to response
  // --------------------------------------------------

  const getRelativePoint = (
    touch: React.Touch
  ): Point | null => {
    if (
      !responseRef.current
    ) {
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
  // Distance between two points
  // --------------------------------------------------

  const getDistance = (
    point1: Point,
    point2: Point
  ) => {
    const deltaX =
      point2.x -
      point1.x;

    const deltaY =
      point2.y -
      point1.y;

    return Math.sqrt(
      deltaX * deltaX +
        deltaY * deltaY
    );
  };

  // --------------------------------------------------
  // Closed lasso detection
  // --------------------------------------------------

  const isLassoClosed = (
    points: Point[]
  ) => {
    if (
      points.length < 10
    ) {
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

    const CLOSE_THRESHOLD =
      50;

    return (
      closingDistance <=
      CLOSE_THRESHOLD
    );
  };

  // --------------------------------------------------
  // Point-in-polygon algorithm
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
        yi > y !==
          yj > y &&
        x <
          ((xj - xi) *
            (y - yi)) /
            (yj - yi) +
            xi;

      if (intersects) {
        inside =
          !inside;
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
    if (
      !responseRef.current
    ) {
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
        if (
          !wordElement
        ) {
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

        const wordCenter: Point =
          {
            x: centerX,
            y: centerY,
          };

        if (
          isPointInsidePolygon(
            wordCenter,
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
  // Touch start
  // --------------------------------------------------

  const handleTouchStart = (
    event:
      React.TouchEvent<HTMLDivElement>
  ) => {
    // Two fingers means pinch.
    if (
      event.touches.length >
      1
    ) {
      setIsLassoing(
        false
      );

      setLassoPoints(
        []
      );

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

    // Starting a new lasso closes
    // the previous Deep Dive.
    setShowDeepDive(
      false
    );

    setDeepDiveText(
      ""
    );

    setDeepDivePosition(
      null
    );

    setSelectedWordIndexes(
      []
    );

    setIsLassoing(
      true
    );

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
    event:
      React.TouchEvent<HTMLDivElement>
  ) => {
    if (
      event.touches.length >
      1
    ) {
      setIsLassoing(
        false
      );

      setLassoPoints(
        []
      );

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

  const handleTouchEnd =
    () => {
      if (
        !isLassoing
      ) {
        return;
      }

      setIsLassoing(
        false
      );

      if (
        lassoPoints.length <
        10
      ) {
        setLassoPoints(
          []
        );

        setGesture(
          "Lasso too small"
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

        setTimeout(
          () => {
            setLassoPoints(
              []
            );
          },
          500
        );

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

        setTimeout(
          () => {
            setLassoPoints(
              []
            );
          },
          500
        );

        return;
      }

      // Highlight the words.
      setSelectedWordIndexes(
        selectedIndexes
      );

      // Remove lasso line.
      setLassoPoints([]);

      // Start contextual Deep Dive.
      elaborateSelection(
        selectedIndexes
      );
    };

  // --------------------------------------------------
  // SVG lasso path
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
          touchAction:
            "none",
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
            (
              word,
              index
            ) => (
              <span
                key={`${word}-${index}`}
                ref={(
                  element
                ) => {
                  wordRefs.current[
                    index
                  ] =
                    element;
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
                words.length -
                  1
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
                // Prevent touching the card
                // from starting another lasso.
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