import { LoaderCircleIcon, LockIcon, MessageCircleQuestionIcon, StoreIcon, Trash2Icon } from 'lucide-react'
import { useId, useMemo, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { phase, type LotState } from '@/domain/lot'
import { QA, seededQuestions, type AskRejection, type Question } from '@/domain/questions'
import type { Vehicle } from '@/domain/vehicle'
import { vehicles } from '@/domain/vehicles'
import { formatAgo, formatLocation } from '@/lib/format'
import { cn } from '@/lib/utils'
import { auction, useDemoStart, useQuestions } from '@/state/auction-store'

/** Where seeded questions come from: the cities in the dataset, never invented names. */
const PLACES = [...new Set(vehicles.map((v) => formatLocation(v.city, v.province)))].sort()

const REJECTION_TEXT: Record<AskRejection, string> = {
  'auction-ended': 'This auction has ended, so questions are closed.',
  empty: 'Write a question first.',
  'too-long': `Keep it under ${QA.maxLength} characters.`,
  'contact-details': 'Please leave out phone numbers and email addresses. Keep the conversation here.',
  disrespectful: "That doesn't follow the guidelines. Please keep it respectful.",
}

/** P40: questions and answers on a lot, like Bring a Trailer's comments. */
export function QuestionsSection({ vehicle, lot, now }: { vehicle: Vehicle; lot: LotState; now: number }) {
  const ended = phase(lot, now) === 'ended'
  const demoStart = useDemoStart()
  const mine = useQuestions()
  const seeded = useMemo(() => seededQuestions(vehicle, PLACES, demoStart), [vehicle, demoStart])
  const all = [...seeded, ...mine.filter((q) => q.lot === vehicle.lot)]

  return (
    <section aria-labelledby="questions-heading" className="scroll-mt-20 rounded-xl border bg-card p-4 sm:p-5">
      <h2 id="questions-heading" className="text-lg font-semibold">
        Questions & answers <span className="font-normal text-muted-foreground tabular-nums">({all.length})</span>
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {ended
          ? 'This auction has ended. The questions and answers stay up for reference.'
          : 'Ask the seller anything about this car. Questions and answers are public, so other buyers see them too.'}
      </p>

      {all.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <MessageCircleQuestionIcon className="size-4" aria-hidden />
          {ended ? 'Nobody asked a question about this car.' : 'No questions yet. Be the first to ask.'}
        </p>
      ) : (
        <ul className="mt-4 divide-y">
          {all.map((q) => (
            <QuestionItem key={q.id} question={q} seller={vehicle.selling_dealership} now={now} />
          ))}
        </ul>
      )}

      {ended ? (
        <p className="mt-4 flex items-center gap-2 border-t pt-4 text-sm text-muted-foreground">
          <LockIcon className="size-4" aria-hidden />
          Questions are closed because the auction has ended.
        </p>
      ) : (
        <AskForm lot={vehicle.lot} />
      )}
    </section>
  )
}

function QuestionItem({ question: q, seller, now }: { question: Question; seller: string; now: number }) {
  const yours = q.author === 'you'
  return (
    <li className="py-3 first:pt-0">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          <span className={cn('font-medium', yours ? 'text-primary' : 'text-foreground')}>
            {yours ? 'You' : `Buyer in ${q.author}`}
          </span>{' '}
          · {formatAgo(now - q.askedAt)}
        </p>
        {yours && (
          <Button
            variant="ghost"
            size="icon"
            className="-mt-1.5 size-7 text-muted-foreground"
            onClick={() => auction.deleteQuestion(q.id)}
          >
            <Trash2Icon className="size-3.5" aria-hidden />
            <span className="sr-only">Delete your question</span>
          </Button>
        )}
      </div>
      <p className="mt-0.5 text-sm">{q.text}</p>

      {q.answered && q.answer ? (
        <div className="mt-2 rounded-md border-l-2 border-primary/50 bg-muted/50 px-3 py-2">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <StoreIcon className="size-3.5" aria-hidden />
            <span className="font-medium text-foreground">Seller · {seller}</span>
            {q.answerAt !== null && <> · {formatAgo(now - q.answerAt)}</>}
          </p>
          <p className="mt-0.5 text-sm">{q.answer}</p>
        </div>
      ) : yours ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
          Waiting for the seller to answer
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">Not answered yet</p>
      )}
    </li>
  )
}

function AskForm({ lot }: { lot: string }) {
  const ids = { input: useId(), help: useId() }
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const left = QA.maxLength - text.length

  function submit(e: FormEvent) {
    e.preventDefault()
    const result = auction.ask(lot, text)
    if (!result.ok) return setError(REJECTION_TEXT[result.reason])
    setText('')
    setError(null)
  }

  return (
    <form onSubmit={submit} noValidate className="mt-4 border-t pt-4">
      <label htmlFor={ids.input} className="text-sm font-medium">
        Ask a question
      </label>
      <p id={ids.help} className="mt-0.5 text-xs text-muted-foreground">
        Keep it about the car. Be respectful: no personal attacks, and no phone numbers or emails.
      </p>
      <textarea
        id={ids.input}
        rows={3}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setError(null)
        }}
        aria-describedby={ids.help}
        aria-invalid={error !== null}
        placeholder="Any rust underneath? Do you have the service records?"
        className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-invalid:border-destructive"
      />
      <div className="mt-1 flex items-start justify-between gap-3">
        <p role={error ? 'alert' : undefined} className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>
          {error ?? (left < 100 ? `${left} characters left` : '')}
        </p>
        <Button type="submit" size="sm" className="shrink-0 pointer-coarse:h-10">
          Post question
        </Button>
      </div>
    </form>
  )
}
