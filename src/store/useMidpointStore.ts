import { nanoid } from 'nanoid'
import { create } from 'zustand'

import type { MidpointResult, Person } from '../types'

const MAX_PEOPLE = 6
const DEFAULT_PEOPLE_COUNT = 2

function createPeople(count: number): Person[] {
  return Array.from({ length: count }, () => ({
    id: nanoid(),
    location: '',
  }))
}

interface MidpointState {
  people: Person[]
  purpose: string
  preferFoods: string[]
  excludeFoods: string[]
  budget: string
  vibe: string
  movePriority: string
  result: MidpointResult | null
  isLoading: boolean
  locationMap: Map<string, string>

  addPerson: () => void
  removePerson: (id: string) => void
  updateLocation: (id: string, location: string) => void
  setPurpose: (purpose: string) => void
  togglePrefer: (food: string) => void
  toggleExclude: (food: string) => void
  setBudget: (budget: string) => void
  setVibe: (vibe: string) => void
  setMovePriority: (movePriority: string) => void
  setResult: (result: MidpointResult | null) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

const initialPeople = createPeople(DEFAULT_PEOPLE_COUNT)

const initialState = {
  people: initialPeople,
  purpose: '',
  preferFoods: [] as string[],
  excludeFoods: [] as string[],
  budget: '',
  vibe: '',
  movePriority: '',
  result: null as MidpointResult | null,
  isLoading: false,
  locationMap: new Map<string, string>(),
}

function toggleItem(items: string[], item: string): string[] {
  return items.includes(item)
    ? items.filter((value) => value !== item)
    : [...items, item]
}

export const useMidpointStore = create<MidpointState>((set) => ({
  ...initialState,

  addPerson: () =>
    set((state) => {
      if (state.people.length >= MAX_PEOPLE) return state

      const id = nanoid()
      const location = state.locationMap.get(id) ?? ''

      return {
        people: [...state.people, { id, location }],
      }
    }),

  removePerson: (id) =>
    set((state) => {
      if (state.people.length <= DEFAULT_PEOPLE_COUNT) return state

      return {
        people: state.people.filter((person) => person.id !== id),
      }
    }),

  updateLocation: (id, location) =>
    set((state) => {
      const locationMap = new Map(state.locationMap)
      locationMap.set(id, location)

      return {
        locationMap,
        people: state.people.map((person) =>
          person.id === id ? { ...person, location } : person,
        ),
      }
    }),

  setPurpose: (purpose) => set({ purpose }),

  togglePrefer: (food) =>
    set((state) => ({
      preferFoods: toggleItem(state.preferFoods, food),
    })),

  toggleExclude: (food) =>
    set((state) => ({
      excludeFoods: toggleItem(state.excludeFoods, food),
    })),

  setBudget: (budget) => set({ budget }),

  setVibe: (vibe) => set({ vibe }),

  setMovePriority: (movePriority) => set({ movePriority }),

  setResult: (result) => set({ result }),

  setLoading: (isLoading) => set({ isLoading }),

  reset: () =>
    set({
      ...initialState,
      people: createPeople(DEFAULT_PEOPLE_COUNT),
      locationMap: new Map<string, string>(),
    }),
}))

export { DEFAULT_PEOPLE_COUNT, MAX_PEOPLE }
