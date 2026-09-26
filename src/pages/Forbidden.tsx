import { useNavigate } from 'react-router-dom'
import { paths } from '../app/paths'
import { Button } from '../ui'
import { PAGE_COPY } from '../constants/messages'

export default function Forbidden() {
  const navigate = useNavigate()
  const copy = PAGE_COPY.forbidden
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <h1 className="ui-title text-lg mb-2">{copy.title}</h1>
      <p className="ui-subtitle text-sm mb-6 max-w-sm">{copy.body}</p>
      <Button variant="solid" onClick={() => navigate(paths.dashboard)}>
        {copy.action}
      </Button>
    </div>
  )
}
