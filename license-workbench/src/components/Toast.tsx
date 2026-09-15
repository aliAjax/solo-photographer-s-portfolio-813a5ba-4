import { useEffect } from 'react'
import { useStore } from '../store'

export default function Toast() {
  const { state, dispatch } = useStore()
  const toast = state.toast

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => dispatch({ type: 'toast/clear', id: toast.id }), 3200)
    return () => clearTimeout(t)
  }, [toast, dispatch])

  if (!toast) return null
  return (
    <div className={`toast toast-${toast.kind}`} data-testid="toast" role="status">
      {toast.text}
    </div>
  )
}
