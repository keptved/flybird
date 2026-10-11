function App() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <h1 className="text-3xl font-bold text-slate-800 mb-4">灵感助手</h1>
      <p className="text-slate-600">
        项目脚手架已就绪：React + Vite + TypeScript + Tailwind CSS
      </p>
      <div className="mt-6 flex gap-4">
        <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
          前端 5173
        </span>
        <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
          后端 8000
        </span>
      </div>
    </div>
  )
}

export default App
