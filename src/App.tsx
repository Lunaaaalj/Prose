import { Editor } from "./components/Editor";

function App() {
  return (
    <main className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-[720px] px-6 py-12">
        <Editor />
      </div>
    </main>
  );
}

export default App;
