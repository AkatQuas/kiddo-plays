import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function Counter() {
  const [count, setCount] = useState(0)
  const { t } = useTranslation('menu')

  const increment = () => setCount(count + 1)
  const decrement = () => {
    setCount(count - 1)
  }

  return (
    <div className="w-full h-[200px] flex items-center justify-center gap-8">
      <button
        className="px-6 py-3 bg-red-500 text-white text-xl rounded-lg hover:bg-red-600 active:scale-95 transition-all"
        onClick={decrement}
      >
        -
      </button>

      <span className="text-4xl font-bold">
        {t('main')} {count}
      </span>

      <button
        className="px-6 py-3 bg-green-500 text-white text-xl rounded-lg hover:bg-green-600 active:scale-95 transition-all"
        onClick={increment}
      >
        +
      </button>
    </div>
  )
}
