// Integration test (issue #170): unlike App.test.jsx — which mocks all five
// views, Layout, the db, etc. to isolate App's routing/theme/OAuth logic — this
// mounts the REAL App over real views and a real Dexie database backed by
// fake-indexeddb. It catches contract drift between App's props and a view's
// expectations that the fully-mocked suite can't see. Deliberately lightweight:
// render the default view, then navigate to another real view over real data.
import 'fake-indexeddb/auto'
import { render, screen, fireEvent } from '@testing-library/react'
import App from './App'
import { db } from './db'

beforeEach(async () => {
  // Fresh database per test so seeded data is deterministic.
  await db.delete()
  await db.open()
})

describe('App ↔ views integration (real views + fake-indexeddb)', () => {
  it('renders the real Timer view by default and navigates to the real Jobs view', async () => {
    await db.jobs.add({ name: 'Integration Co', isActive: true, laborRates: {} })

    render(<App />)

    // Real TimerView mounts as the default view (its "Active" header).
    expect(await screen.findByRole('heading', { name: 'Active', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /punch in/i })).toBeInTheDocument()

    // Navigate via the real bottom-nav Layout to the real JobsView, which reads
    // the seeded job from the real db via useLiveQuery.
    fireEvent.click(screen.getByRole('button', { name: 'Jobs' }))
    expect(await screen.findByText('Integration Co')).toBeInTheDocument()
  })
})
