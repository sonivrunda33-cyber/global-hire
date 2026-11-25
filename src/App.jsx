import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BriefcaseBusiness, Building2, Check,
  ChevronDown, CircleHelp, Command, Eye, EyeOff, Globe2, Heart, LockKeyhole, Mail,
  MapPin, Menu, Search, ShieldCheck, Sparkles, Users, X, Zap
} from 'lucide-react'
import {
  AdminDashboard, ApplicationsPage, ApplyPage, CandidateDashboard, CompanyDetailPage,
  CompanyDirectoryPage, InfoPage, JobDetailPage, JobsPage, ProfilePage, RecruiterDashboard,
  SavedJobsPage, SAMPLE_COMPANIES, SAMPLE_JOBS
} from './pages.jsx'

async function apiRequest(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.')
  return data
}

function getRoute() {
  const p = window.location.pathname.replace(/\/$/, '')
  return p || '/'
}

function Brand({ light = false }) {
  return <a className={`brand ${light ? 'brand-light' : ''}`} href="/" aria-label="GlobalHire home" onClick={navigate}>
    <span className="brand-mark"><Globe2 size={20} strokeWidth={2.2} /></span>
    <span>global<span>hire</span></span>
  </a>
}

function navigate(event) {
  const link = event.currentTarget
  const href = link.getAttribute('href')
  if (!href || href.startsWith('#')) return
  event.preventDefault()
  window.history.pushState({}, '', href)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function App() {
  const [route, setRoute] = useState(getRoute)
  const [user, setUser] = useState(null)
  const [profileRole, setProfileRole] = useState('candidate')
  const [notice, setNotice] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [place, setPlace] = useState('')
  const [jobListings, setJobListings] = useState(SAMPLE_JOBS)
  const [companyDirectory, setCompanyDirectory] = useState(SAMPLE_COMPANIES.map(c => ({ ...c, sample: true })))
  const [saved, setSaved] = useState(() => { try { return JSON.parse(localStorage.getItem('globalhire:saved') || '[]') } catch { return [] } })

  useEffect(() => {
    window.globalhireApi = apiRequest
    const onPop = () => setRoute(getRoute())
    const onAuth = event => {
      const authUser = event.detail
      setUser(authUser || null)
      setProfileRole(authUser?.role || authUser?.user_metadata?.role || 'candidate')
    }
    window.addEventListener('popstate', onPop)
    window.addEventListener('globalhire:auth', onAuth)
    apiRequest('/me').then(({ user: authUser, role, saved: savedIds }) => {
      setUser(authUser)
      setProfileRole(role || 'candidate')
      if (savedIds?.length) setSaved(current => [...new Set([...current, ...savedIds])])
    }).catch(() => {})
    apiRequest('/jobs').then(({ jobs }) => { if (jobs?.length) setJobListings(jobs) }).catch(() => {})
    apiRequest('/companies').then(({ companies }) => { if (companies?.length) setCompanyDirectory(companies) }).catch(() => {})
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('globalhire:auth', onAuth) }
  }, [])

  useEffect(() => { localStorage.setItem('globalhire:saved', JSON.stringify(saved)) }, [saved])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 5200)
    return () => clearTimeout(t)
  }, [notice])

  const filteredJobs = useMemo(() => jobListings.filter(job =>
    `${job.title} ${job.company} ${job.tag}`.toLowerCase().includes(query.toLowerCase()) &&
    `${job.location}`.toLowerCase().includes(place.toLowerCase())
  ), [query, place])

  const toggleSaved = (jobOrId) => {
    const job = typeof jobOrId === 'object' ? jobOrId : jobListings.find(item => item.id === jobOrId || item.title === jobOrId)
    const id = job?.id || jobOrId
    const wasSaved = saved.includes(id)
    setSaved(s => wasSaved ? s.filter(x => x !== id) : [...s, id])
    if (user && profileRole === 'candidate' && job) apiRequest(`/saved/${encodeURIComponent(job.slug || job.id)}`, { method: wasSaved ? 'DELETE' : 'POST' }).catch(() => {})
  }

  const notify = (message) => {
    setNotice(message)
    window.dispatchEvent(new CustomEvent('globalhire:notice', { detail: message }))
  }

  const privateRoute = route === '/dashboard' || route === '/applications' || route === '/saved' || route === '/profile' || route === '/admin' || route.startsWith('/apply/') || route.startsWith('/recruiter/') || route === '/company-profile'
  if (privateRoute && !user) return <AuthPage mode="login" setNotice={setNotice} user={user} />

  const handleLogout = async () => {
    await apiRequest('/auth/logout', { method: 'POST' }).catch(() => {})
    setUser(null)
    setNotice({ type: 'success', text: 'You have signed out.' })
  }

  if (route === '/login' || route === '/register' || route === '/forgot-password') {
    return <AuthPage mode={route.slice(1)} setNotice={setNotice} user={user} />
  }
  if (route === '/jobs') return <JobsPage jobs={jobListings} saved={saved} onSave={toggleSaved} user={user} onLogout={handleLogout} />
  if (route.startsWith('/jobs/')) {
    const jobId = route.split('/')[2]
    const job = jobListings.find(item => item.id === jobId || item.slug === jobId)
    return <JobDetailPage job={job} user={user} onLogout={handleLogout} onApply={item => {
      if (!user) { window.history.pushState({}, '', '/login'); window.dispatchEvent(new PopStateEvent('popstate')); window.scrollTo(0, 0); return }
      window.history.pushState({}, '', `/apply/${item.id}`); window.dispatchEvent(new PopStateEvent('popstate')); window.scrollTo(0, 0)
    }} />
  }
  if (route === '/companies') return <CompanyDirectoryPage companies={companyDirectory} user={user} onLogout={handleLogout} />
  if (route.startsWith('/companies/')) {
    const company = companyDirectory.find(item => item.id === route.split('/')[2] || item.name === route.split('/')[2])
    return <CompanyDetailPage company={company} jobs={jobListings} user={user} onLogout={handleLogout} />
  }
  if (route.startsWith('/apply/')) {
    const job = jobListings.find(item => item.id === route.split('/')[2])
    return <ApplyPage job={job} user={user} onLogout={handleLogout} onNotice={notify} />
  }
  if (route === '/dashboard') {
    return profileRole === 'recruiter'
      ? <RecruiterDashboard user={user} onLogout={handleLogout} companies={companyDirectory} onNotice={notify} />
      : <CandidateDashboard user={user} onLogout={handleLogout} jobs={jobListings} saved={saved} onSave={toggleSaved} onNotice={notify} />
  }
  if (route === '/applications') return <ApplicationsPage user={user} onLogout={handleLogout} />
  if (route === '/saved') return <SavedJobsPage jobs={jobListings} saved={saved} onSave={toggleSaved} user={user} onLogout={handleLogout} />
  if (route === '/profile') return <ProfilePage user={user} onLogout={handleLogout} onNotice={notify} />
  if (route === '/admin') return profileRole === 'admin' ? <AdminDashboard user={user} onLogout={handleLogout} /> : <InfoPage path="/contact" user={user} onLogout={handleLogout} />
  if (route !== '/') return <InfoPage path={route} user={user} onLogout={handleLogout} />
  return <>
    <div className="announcement"><Sparkles size={14} /> A more thoughtful way to find your next role <a href="#how-it-works">See how it works <ArrowRight size={13} /></a></div>
    <header className="site-header">
      <div className="nav-wrap">
        <Brand />
        <nav className={`main-nav ${mobileOpen ? 'is-open' : ''}`}>
          <a href="/jobs" onClick={navigate}>Find a job</a>
          <a href="/companies" onClick={navigate}>Companies</a>
          <a href="#how-it-works" onClick={() => setMobileOpen(false)}>How it works</a>
          <a href="#resources" onClick={() => setMobileOpen(false)}>Career resources</a>
          <div className="mobile-actions"><a className="btn btn-ghost" href="/login" onClick={navigate}>Log in</a><a className="btn btn-primary" href="/register" onClick={navigate}>Get started <ArrowUpRight size={16} /></a></div>
        </nav>
        <div className="nav-actions">
          {user ? <><span className="user-pill"><span className="online-dot" />{user.user_metadata?.full_name || user.email?.split('@')[0]}</span><a className="btn btn-primary btn-sm" href="/dashboard" onClick={navigate}>Dashboard <ArrowUpRight size={15} /></a></> : <><a className="login-link" href="/login" onClick={navigate}>Log in</a><a className="btn btn-primary btn-sm" href="/register" onClick={navigate}>Get started <ArrowUpRight size={15} /></a></>}
        </div>
        <button className="mobile-menu" aria-label="Toggle menu" onClick={() => setMobileOpen(v => !v)}>{mobileOpen ? <X /> : <Menu />}</button>
      </div>
    </header>

    <main>
      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-grid">
          <div className="hero-copy animate-rise">
            <div className="eyebrow light-eyebrow"><span className="eyebrow-dot" /> YOUR NEXT CHAPTER STARTS HERE</div>
            <h1>Good work<br />finds <em>you.</em></h1>
            <p className="hero-lede">Meet the teams, ideas, and opportunities that help you do the best work of your life.</p>
            <form className="search-box" onSubmit={e => { e.preventDefault(); document.getElementById('jobs')?.scrollIntoView({ behavior: 'smooth' }) }}>
              <label className="search-field"><Search size={19} /><input aria-label="Job title or keyword" placeholder="Role, skill or company" value={query} onChange={e => setQuery(e.target.value)} /></label>
              <span className="search-divider" />
              <label className="search-field search-location"><MapPin size={18} /><input aria-label="Location" placeholder="Anywhere in the world" value={place} onChange={e => setPlace(e.target.value)} /></label>
              <button className="search-submit" type="submit">Explore roles <ArrowRight size={17} /></button>
            </form>
            <div className="popular-searches"><span>Popular:</span>{['Product design', 'Remote', 'People & talent', 'Engineering'].map((x, i) => <a href="#jobs" key={x} onClick={() => { if (i !== 1) setQuery(x.split(' ')[0]); else setPlace('Remote') }}>{x}</a>)}</div>
          </div>
          <div className="hero-art" aria-label="Illustration of a person exploring career opportunities">
            <div className="orbit orbit-one" /><div className="orbit orbit-two" />
            <div className="hero-blob"><div className="blob-shine" /></div>
            <div className="person"><div className="person-hair" /><div className="person-head"><div className="person-eye" /><div className="person-nose" /><div className="person-smile" /></div><div className="person-neck" /><div className="person-body"><div className="person-shirt" /></div><div className="person-arm" /></div>
            <div className="float-card match-card"><span className="match-icon"><Sparkles size={17} /></span><span><b>Great match</b><small>Your skills, their mission</small></span><span className="match-score">94%</span></div>
            <div className="float-card role-card"><span className="role-logo">S</span><span><b>Product Designer</b><small>Somewhere Studio · Remote</small></span></div>
            <div className="hero-caption"><span className="caption-line" /> A world of possibility, made personal.</div>
            <span className="star star-a">✳</span><span className="star star-b">✦</span><span className="star star-c">✳</span>
          </div>
        </div>
        <div className="hero-bottom"><span>MADE FOR PEOPLE. BUILT FOR POSSIBILITY.</span><a href="#jobs">Scroll to explore <ArrowDown size={14} /></a><span className="hero-index">01 / 04</span></div>
      </section>

      <section className="trust-strip">
        <div className="trust-copy"><span className="eyebrow">SAMPLE COMPANY NAMES · FOR ILLUSTRATION</span><p>Thoughtful people. <span>Remarkable places.</span></p></div>
        <div className="trust-logos"><span className="logo-word logo-word-one">northstar</span><span className="logo-word logo-word-two">cloudline</span><span className="logo-word logo-word-three">daybreak</span><span className="logo-word logo-word-four">kinfolk</span></div>
      </section>

      <section className="section jobs-section" id="jobs">
        <div className="section-heading"><div><span className="eyebrow">A GOOD PLACE TO BEGIN</span><h2>Work that moves<br className="mobile-break" /> <em>you forward.</em></h2></div><a className="text-link" href="/register" onClick={navigate}>Explore all opportunities <ArrowUpRight size={16} /></a></div>
        <div className="job-list">{filteredJobs.length ? filteredJobs.slice(0, 3).map((job, i) => <article className={`job-card reveal reveal-delay-${i + 1}`} key={job.id}>
          <div className={`company-logo ${job.color}`}>{job.logo}</div><div className="job-main"><div className="job-topline"><h3><a href={`/jobs/${job.slug || job.id}`}>{job.title}</a></h3><span className="posted">{job.posted}</span></div><p className="company-name">{job.company} <span>·</span> {job.tag}</p><div className="job-meta"><span><MapPin size={14} />{job.location}</span><span><BriefcaseBusiness size={14} />{job.type}</span><span className="salary">{job.pay}</span></div></div><button className={`save-btn ${saved.includes(job.id) ? 'is-saved' : ''}`} aria-label={saved.includes(job.id) ? 'Remove saved job' : 'Save job'} onClick={() => toggleSaved(job)}><Heart size={18} fill={saved.includes(job.id) ? 'currentColor' : 'none'} /></button><a className="job-arrow" href={`/jobs/${job.slug || job.id}`} aria-label={`View ${job.title}`}><ArrowUpRight size={19} /></a>{job.sample && <div className="sample-label">SAMPLE ROLE</div>}
        </article>) : <div className="empty-state"><Search size={22} /><b>No roles match that search yet</b><span>Try another title or location.</span><button className="text-link" onClick={() => { setQuery(''); setPlace('') }}>Clear search</button></div>}</div>
        <p className="demo-note"><CircleHelp size={14} /> Listings marked sample are illustrative. Live vacancies are loaded from the database when available.</p>
        <div className="jobs-foot"><span className="mini-stat"><strong>2.4k+</strong> open possibilities</span><span className="foot-dot" /><span>New roles added every week</span><a href="/register" onClick={navigate}>Get job alerts <ArrowRight size={15} /></a></div>
      </section>

      <section className="company-section" id="companies"><div className="section company-inner"><div className="section-heading"><div><span className="eyebrow">PLACES WITH PURPOSE</span><h2>Find your <em>people.</em></h2><p className="section-sub">Get to know the teams shaping what comes next.</p><p className="company-sample-note">Illustrative sample profiles only; no employer partnerships are implied.</p></div><a className="text-link" href="/companies" onClick={navigate}>Meet every company <ArrowUpRight size={16} /></a></div>
        <div className="company-grid">{companyDirectory.slice(0, 4).map((c, i) => <a className={`company-card reveal reveal-delay-${i + 1}`} href={`/companies/${c.id}`} key={c.id}><div className={`company-logo logo-lg ${c.color}`}>{c.logo}</div><ArrowUpRight className="company-arrow" size={18} /><h3>{c.name}</h3><p>{c.field}</p><div className="company-openings"><span><span className="open-dot" /> {c.jobs} open roles</span><span>View team <ArrowRight size={14} /></span></div>{c.sample && <div className="sample-label">SAMPLE PROFILE</div>}</a>)}</div>
      </div></section>

      <section className="section how-section" id="how-it-works"><div className="how-intro"><span className="eyebrow">A LITTLE MORE HUMAN</span><h2>Your next move<br />should feel <em>right.</em></h2><p>Finding a job is about more than a title. It’s about finding a place where you can make a difference, keep growing, and feel like yourself.</p><a className="btn btn-dark" href="/register" onClick={navigate}>Find your next chapter <ArrowRight size={16} /></a><div className="how-scribble">good things<br /><span>start here</span> <ArrowDown size={19} /></div></div>
        <div className="steps"><article className="step-card"><span className="step-number">01</span><div className="step-icon step-icon-lilac"><Search size={22} /></div><div><h3>Tell us what matters</h3><p>Share what you’re good at and what you’re looking for. We’ll help the right opportunities find their way to you.</p></div><ArrowUpRight size={18} className="step-arrow" /></article><article className="step-card"><span className="step-number">02</span><div className="step-icon step-icon-peach"><Building2 size={22} /></div><div><h3>Meet your kind of team</h3><p>Explore people-first companies, honest role details, and work that fits the life you want to build.</p></div><ArrowUpRight size={18} className="step-arrow" /></article><article className="step-card"><span className="step-number">03</span><div className="step-icon step-icon-green"><Zap size={22} /></div><div><h3>Make your next move</h3><p>Apply with confidence, follow your progress, and take your next step knowing it feels right.</p></div><ArrowUpRight size={18} className="step-arrow" /></article></div>
      </section>

      <section className="cta-band" id="resources"><div className="cta-decoration">✳</div><div><span className="eyebrow light-eyebrow">THE NEXT CHAPTER IS YOURS</span><h2>Let’s find the place<br />you <em>belong.</em></h2><p>Set up your free profile and find the teams looking for someone like you.</p></div><a className="btn btn-gold" href="/register" onClick={navigate}>Create your free profile <ArrowRight size={17} /></a></section>
    </main>

    <footer className="site-footer"><div className="footer-main"><div className="footer-brand"><Brand light /><p>Discover opportunities.<br />Build your future.</p></div><div className="footer-col"><b>Explore</b><a href="#jobs">Find a job</a><a href="#companies">Companies</a><a href="#how-it-works">How it works</a></div><div className="footer-col"><b>For people</b><a href="/register" onClick={navigate}>Create a profile</a><a href="/login" onClick={navigate}>Sign in</a><a href="#resources">Career resources</a></div><div className="footer-col"><b>For teams</b><a href="/register" onClick={navigate}>Post a role</a><a href="/register" onClick={navigate}>Find great people</a><a href="#resources">Recruiter resources</a></div><div className="footer-newsletter"><b>A little good news.</b><p>Notes on work, growth, and finding your place.</p><form onSubmit={e => { e.preventDefault(); setNotice({ type: 'success', text: 'Thanks for subscribing. Newsletter sign-up is saved for the full launch.' }) }}><input type="email" required placeholder="Your email address" aria-label="Email address for newsletter" /><button aria-label="Subscribe"><ArrowRight size={17} /></button></form></div></div><div className="footer-bottom"><span>© 2026 GlobalHire. Made for what’s next.</span><div><a href="#privacy">Privacy</a><a href="#terms">Terms</a><a href="#accessibility">Accessibility</a></div><span className="footer-location"><Globe2 size={14} /> Wherever you are</span></div></footer>
    {notice && <div className={`toast toast-${notice.type}`} role="status"><Check size={17} />{notice.text}<button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={16} /></button></div>}
  </>
}

function AuthPage({ mode, setNotice, user }) {
  const [role, setRole] = useState('candidate')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const isRegister = mode === 'register'
  const isForgot = mode === 'forgot-password'
  const isLogin = mode === 'login'

  const submit = async (event) => {
    event.preventDefault(); setError('')
    const data = new FormData(event.currentTarget)
    const email = data.get('email')?.toString().trim()
    const password = data.get('password')?.toString()
    setBusy(true)
    try {
      if (isRegister) {
        if (password !== data.get('confirmPassword')) throw new Error('Your passwords do not match.')
        const result = await apiRequest('/auth/register', { method: 'POST', body: JSON.stringify({
          name: data.get('name'), email, password, role,
          companyName: data.get('companyName'), companyWebsite: data.get('companyWebsite'),
          companyLocation: data.get('companyLocation'), industry: data.get('industry'),
        }) })
        window.dispatchEvent(new CustomEvent('globalhire:auth', { detail: result.user }))
        window.history.pushState({}, '', '/dashboard'); window.dispatchEvent(new PopStateEvent('popstate'))
      } else if (isForgot) {
        await apiRequest('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })
      } else {
        const result = await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
        window.dispatchEvent(new CustomEvent('globalhire:auth', { detail: result.user }))
        window.history.pushState({}, '', '/dashboard'); window.dispatchEvent(new PopStateEvent('popstate'))
      }
    } catch (e) { setError(e.message || 'Something went wrong. Please try again.') }
    finally { setBusy(false) }
  }

  const heading = isRegister ? 'Make room for what’s next.' : isForgot ? 'Let’s get you back in.' : 'Welcome back.'
  const description = isRegister ? 'A better fit is closer than you think.' : isForgot ? 'Password recovery needs an email service configured by the site administrator.' : 'Your next chapter is right where you left it.'

  return <div className="auth-shell"><aside className="auth-side"><Brand light /><div className="auth-art"><div className="auth-art-ring" /><span className="auth-art-star">✳</span><div className="auth-art-message"><span className="eyebrow light-eyebrow">SOMETHING GOOD IS OUT THERE</span><h2>Your work<br />can take you<br /><em>anywhere.</em></h2><div className="auth-art-caption"><span className="caption-avatars"><i>A</i><i>M</i><i>J</i></span><span><b>People finding their place</b><small>One good match at a time.</small></span></div></div><div className="auth-orb" /></div><div className="auth-side-bottom"><span>© 2026 GlobalHire</span><span>Made for people. Built for possibility.</span></div></aside>
    <main className="auth-main"><div className="auth-topline"><a href="/" onClick={navigate}><ArrowLeft size={16} /> Back to home</a><span>{isRegister ? 'Already have an account?' : 'New around here?'} <a href={isRegister ? '/login' : '/register'} onClick={navigate}>{isRegister ? 'Log in' : 'Create an account'}</a></span></div>
      <div className="auth-form-wrap"><div className="auth-mobile-brand"><Brand /></div>
        {user ? <div className="success-panel"><span className="success-icon"><Check size={23} /></span><h1>You’re already in.</h1><p>Your GlobalHire account is ready.</p><a className="btn btn-dark full-width" href="/dashboard" onClick={navigate}>Go to dashboard <ArrowRight size={16} /></a></div> : done ? <div className="success-panel"><span className="success-icon"><Check size={23} /></span><span className="eyebrow">CHECK YOUR INBOX</span><h1>{isRegister ? 'One small step left.' : 'A fresh start is on its way.'}</h1><p>{isRegister ? 'Your account has been created.' : 'If an account exists for that email, you’ll receive a link to reset your password.'}</p><a className="text-link" href="/login" onClick={navigate}><ArrowLeft size={15} /> Back to log in</a></div> : <>
          <div className="auth-kicker"><span className="eyebrow">{isRegister ? 'YOUR STORY, STARTING HERE' : isForgot ? 'PASSWORD RESET' : 'GOOD TO SEE YOU AGAIN'}</span><span className="auth-kicker-icon"><Globe2 size={17} /></span></div>
          <h1>{heading}</h1><p className="auth-description">{description}</p>
          {isRegister && <div className="role-switch" role="group" aria-label="Choose account type"><button type="button" className={role === 'candidate' ? 'active' : ''} onClick={() => setRole('candidate')}><Users size={17} /><span><b>I'm looking for work</b><small>Candidate account</small></span>{role === 'candidate' && <Check size={16} />}</button><button type="button" className={role === 'recruiter' ? 'active' : ''} onClick={() => setRole('recruiter')}><Building2 size={17} /><span><b>I'm hiring talent</b><small>Recruiter account</small></span>{role === 'recruiter' && <Check size={16} />}</button></div>}
          <form className="auth-form" onSubmit={submit}>
            {isRegister && <label>Full name<div className="input-wrap"><Users size={17} /><input name="name" placeholder="e.g. Alex Morgan" autoComplete="name" required /></div></label>}
            {isRegister && role === 'recruiter' && <>
              <label>Company name<div className="input-wrap"><Building2 size={17} /><input name="companyName" placeholder="Your organization" autoComplete="organization" required /></div></label>
              <label>Company website<div className="input-wrap"><Globe2 size={17} /><input name="companyWebsite" type="url" placeholder="https://company.com" autoComplete="url" /></div></label>
              <label>Company location<div className="input-wrap"><MapPin size={17} /><input name="companyLocation" placeholder="City, country" required /></div></label>
              <label>Industry<div className="input-wrap"><BriefcaseBusiness size={17} /><input name="industry" placeholder="e.g. Software" required /></div></label>
            </>}
            <label>Email address<div className="input-wrap"><Mail size={17} /><input name="email" type="email" placeholder="you@example.com" autoComplete="email" required /></div></label>
            {!isForgot && <label>Password<div className="input-wrap"><LockKeyhole size={17} /><input name="password" type={showPassword ? 'text' : 'password'} placeholder={isRegister ? 'At least 8 characters' : 'Enter your password'} minLength="8" autoComplete={isRegister ? 'new-password' : 'current-password'} required /><button type="button" className="show-password" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>}
            {isRegister && <label>Confirm password<div className="input-wrap"><LockKeyhole size={17} /><input name="confirmPassword" type="password" placeholder="Enter your password again" minLength="8" autoComplete="new-password" required /></div></label>}
            {isLogin && <div className="form-meta"><label className="check-label"><input type="checkbox" /> <span>Keep me signed in</span></label><a href="/forgot-password" onClick={navigate}>Forgot password?</a></div>}
            {isRegister && <label className="check-label privacy-check"><input type="checkbox" required /> <span>I agree to the <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.</span></label>}
            {error && <div className="form-error" role="alert"><CircleHelp size={16} />{error}</div>}
            <button className="btn btn-dark full-width auth-submit" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Create your account' : isForgot ? 'Send reset link' : 'Log in'} <ArrowRight size={17} /></button>
          </form>
          <div className="auth-security"><ShieldCheck size={16} /><span>Your details are private and securely protected.</span></div>
          {isRegister && <p className="auth-terms-note">By creating an account, you consent to GlobalHire storing your profile information to provide recruitment services.</p>}
        </>}
      </div><div className="auth-bottom"><span>© 2026 GlobalHire</span><a href="#help">Need help?</a></div>
    </main>
  </div>
}

function Dashboard({ user, handleLogout, setNotice }) {
  return <div className="dashboard-page"><header className="site-header"><div className="nav-wrap"><Brand /><span className="dashboard-label"><span className="online-dot" /> Signed in</span><button className="btn btn-ghost btn-sm" onClick={handleLogout}>Sign out</button></div></header><main className="dashboard-content"><div className="eyebrow">YOUR GLOBALHIRE SPACE</div><h1>Welcome{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(' ')[0]}` : ' back'}.</h1><p className="dashboard-lede">You’re signed in. Your personalized job seeker and recruiter tools will live here.</p><div className="dashboard-card"><div className="dash-icon"><Command size={20} /></div><div><h2>Your profile is ready for its next step</h2><p>Complete your profile to get more relevant recommendations and help recruiters discover you.</p></div><span className="progress-ring">20%</span></div><div className="dashboard-actions"><a href="/#jobs" onClick={e => { e.preventDefault(); window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); setTimeout(() => document.getElementById('jobs')?.scrollIntoView({ behavior: 'smooth' }), 50) }} className="btn btn-dark">Browse sample opportunities <ArrowRight size={16} /></a><button className="text-link" onClick={() => setNotice({ type: 'success', text: 'Profile editing will be available when the profile tables are connected.' })}>Complete profile <ArrowUpRight size={16} /></button></div><p className="demo-note"><CircleHelp size={14} /> Jobs, profile editing, and applications will connect to your Supabase database once it is configured.</p></main></div>
}

export default App
