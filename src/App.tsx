import { useState } from "react";
import ResponseBlock from "./components/ResponseBlock";
import "./App.css";

function App() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    try {
      const result = await fetch(
        "/api/generate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: prompt,
          }),
        }
      );

      if (!result.ok) {
        throw new Error("Failed to generate response");
      }

      const data = await result.json();

      setResponse(data.text);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <div className="app">
      <main className="phone-container">
        <h1>Beyond Prompts</h1>
        <p className="subtitle">Interact with AI-generated text using touch.</p>

        <div className="prompt-section">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask something..."
          />

          <button onClick={handleGenerate}>Generate</button>
        </div>

        {response && <ResponseBlock text={response} />}
      </main>
    </div>
  );
}

export default App;