import type { ReactNode } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from '@/components/Layout'
import Home from '@/pages/Home'
import InputPage from '@/pages/Input'
import Resolution from '@/pages/Resolution'
import Graphs from '@/pages/Graphs'
import IntegerPage from '@/pages/Integer'
import Dual from '@/pages/Dual'
import Results from '@/pages/Results'
import Projects from '@/pages/Projects'
import { AppProvider } from '@/store'
import { ToastProvider } from '@/components/ui/toast'

export function AppProviders({ children }: { children: ReactNode }) {
  return <ToastProvider><AppProvider>{children}</AppProvider></ToastProvider>
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="entrada" element={<InputPage />} />
        <Route path="resolucao" element={<Resolution />} />
        <Route path="graficos" element={<Graphs />} />
        <Route path="inteira" element={<IntegerPage />} />
        <Route path="dual" element={<Dual />} />
        <Route path="resultados" element={<Results />} />
        <Route path="projetos" element={<Projects />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return <AppProviders><BrowserRouter><AppRoutes /></BrowserRouter></AppProviders>
}
