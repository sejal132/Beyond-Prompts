import { useState } from "react";
import ResponseBlock from "./components/ResponseBlock";
import "./App.css";

function App() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");

  const handleGenerate = () => {
    if (!prompt.trim()) return;

    // Temporary response — we'll replace this with an LLM later.
    setResponse(
      "Artificial intelligence allows computers to perform tasks that normally require human intelligence. " +
        "Modern AI systems can understand language, recognize patterns, generate content, and assist users with complex tasks."
    );
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