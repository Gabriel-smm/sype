import { describe, expect, it } from 'vitest'

import { parseCapture } from './parse-capture'

// Wednesday 23 September 2026, 10:00 local.
const NOW = new Date(2026, 8, 23, 10, 0)
const parse = (text: string) => parseCapture(text, NOW)

describe('title', () => {
  it('keeps plain words and tidies whitespace', () => {
    expect(parse('  call   the  bank ').title).toBe('call the bank')
  })

  it('strips every recognised token but keeps type words', () => {
    const result = parse('HIST essay fri 5pm 4h 20% !')
    expect(result.title).toBe('HIST essay')
  })

  it('is empty for empty input', () => {
    expect(parse('').title).toBe('')
  })
})

describe('defaults', () => {
  it('fills everything when nothing is recognised', () => {
    const result = parse('call the bank')
    expect(result).toMatchObject({
      due_date: '2026-09-30T23:59:00',
      estimated_duration: 60,
      task_type: 'other',
      grade_weight: 0,
      stress_rating: 3,
    })
    expect(result.matched).toEqual({})
  })

  it('picks the default duration from the kind of work', () => {
    expect(parse('HIST essay').estimated_duration).toBe(360)
    expect(parse('bio midterm').estimated_duration).toBe(240)
    expect(parse('calc pset 3').estimated_duration).toBe(120)
    expect(parse('reading for seminar').estimated_duration).toBe(60)
    expect(parse('email advisor').estimated_duration).toBe(30)
  })
})

describe('duration', () => {
  it.each([
    ['4h', 240],
    ['1.5h', 90],
    ['90m', 90],
    ['2h30', 150],
    ['45min', 45],
    ['3hrs', 180],
  ])('%s is %i minutes', (token, minutes) => {
    const result = parse(`thing ${token}`)
    expect(result.estimated_duration).toBe(minutes)
    expect(result.matched.estimated_duration).toBe(token)
    expect(result.title).toBe('thing')
  })
})

describe('grade', () => {
  it('reads a percentage', () => {
    const result = parse('lab report 15%')
    expect(result.grade_weight).toBe(15)
    expect(result.title).toBe('lab report')
  })

  it('caps at 100', () => {
    expect(parse('everything 250%').grade_weight).toBe(100)
  })
})

describe('stress', () => {
  it('reads ! as tense and !! as dreading it', () => {
    expect(parse('thing !').stress_rating).toBe(4)
    expect(parse('thing !!').stress_rating).toBe(5)
    expect(parse('thing !!!').stress_rating).toBe(5)
  })
})

describe('task type', () => {
  it.each([
    ['HIST essay', 'essay_project'],
    ['term paper', 'essay_project'],
    ['group project', 'essay_project'],
    ['chem exam', 'exam_study'],
    ['bio midterm', 'exam_study'],
    ['stats final', 'exam_study'],
    ['spanish quiz', 'exam_study'],
    ['calc pset 3', 'problem_set'],
    ['physics hw', 'problem_set'],
    ['homework 4', 'problem_set'],
    ['problem set 2', 'problem_set'],
    ['read ch 4', 'reading'],
    ['chapter 7 notes', 'reading'],
    ['email advisor', 'admin'],
    ['register for classes', 'admin'],
  ])('%s is %s', (text, type) => {
    expect(parse(text).task_type).toBe(type)
    expect(parse(text).title).toBe(text)
  })

  it('does not match inside other words', () => {
    expect(parse('contest prep').task_type).toBe('other')
    expect(parse('thread the needle').task_type).toBe('other')
  })
})

describe('due date', () => {
  it.each([
    ['today', '2026-09-23T23:59:00'],
    ['tonight', '2026-09-23T23:59:00'],
    ['tomorrow', '2026-09-24T23:59:00'],
    ['tmr', '2026-09-24T23:59:00'],
    ['fri', '2026-09-25T23:59:00'],
    ['friday', '2026-09-25T23:59:00'],
    ['mon', '2026-09-28T23:59:00'],
    ['next fri', '2026-10-02T23:59:00'],
    ['in 3 days', '2026-09-26T23:59:00'],
    ['10/14', '2026-10-14T23:59:00'],
    ['oct 14', '2026-10-14T23:59:00'],
    ['14 oct', '2026-10-14T23:59:00'],
  ])('%s', (token, due) => {
    const result = parse(`thing ${token}`)
    expect(result.due_date).toBe(due)
    expect(result.matched.due_date).toBe(token)
    expect(result.title).toBe('thing')
  })

  it('treats today\'s weekday as today while its time is still ahead', () => {
    expect(parse('thing wed 5pm').due_date).toBe('2026-09-23T17:00:00')
  })

  it('rolls today\'s weekday to next week once the time has passed', () => {
    expect(parse('thing wed 9am').due_date).toBe('2026-09-30T09:00:00')
  })

  it('rolls a past calendar date into next year', () => {
    expect(parse('thing 3/1').due_date).toBe('2027-03-01T23:59:00')
  })
})

describe('due time', () => {
  it.each([
    ['5pm', '17:00'],
    ['5:30pm', '17:30'],
    ['11am', '11:00'],
    ['12am', '00:00'],
    ['12pm', '12:00'],
    ['17:00', '17:00'],
    ['noon', '12:00'],
    ['midnight', '23:59'],
  ])('%s is %s', (token, clock) => {
    const result = parse(`thing tomorrow ${token}`)
    expect(result.due_date).toBe(`2026-09-24T${clock}:00`)
    expect(result.matched.due_time).toBe(token)
    expect(result.title).toBe('thing')
  })

  it('with no date means today, or tomorrow if already past', () => {
    expect(parse('thing 5pm').due_date).toBe('2026-09-23T17:00:00')
    expect(parse('thing 8am').due_date).toBe('2026-09-24T08:00:00')
  })
})

describe('everything at once', () => {
  it('parses the canonical example', () => {
    expect(parse('HIST essay fri 5pm 4h 20%')).toEqual({
      title: 'HIST essay',
      due_date: '2026-09-25T17:00:00',
      estimated_duration: 240,
      task_type: 'essay_project',
      grade_weight: 20,
      stress_rating: 3,
      matched: {
        due_date: 'fri',
        due_time: '5pm',
        estimated_duration: '4h',
        grade_weight: '20%',
        task_type: 'essay',
      },
    })
  })
})
