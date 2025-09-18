import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import TestBackground from './components/TestBackground'
import './App.css'
import CRTSceneR3F from './components/CRTShaderScene'
import TransparentCRTOverlay from './components/CRTEffect'

function App() {
  const [count, setCount] = useState(0)

  return (
   <div>
    <TestBackground />
    <TransparentCRTOverlay
        
        opacity={0.55}
        scanlineDensity={1500}
        scanlineIntensity={0.14}
        vignette={0.45}
        noise={0.05}
        flicker={0.02}
        rgbOffset={1.0}
      />
   </div>
  )
}

export default App
