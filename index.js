require('dotenv').config()
const snoowrap = require('snoowrap')
const axios = require('axios')

const r = new snoowrap({
    userAgent: process.env.USERAGENT,
    clientId: process.env.REDDITID,
    clientSecret: process.env.REDDITSECRET,
    username: process.env.REDDITUSER,
    password: process.env.REDDITPASS
})

const current = {
    date: null,
    tid: null,
    streams: {
        recent: [],
        archived: []
    }
}

run();

async function run() {
    const delayInMinutes = 1

    const d = new Date();
    const prettyDate = new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'America/Los_Angeles'
    }).format(d)

    const streams = await getStreams()

    try {
        if (streams !== false) {
            const threadContent = await formatThread(prettyDate, streams)
            const threadExists = await checkForThread(prettyDate)
        
            if (!threadExists) {
                console.log('no thread yet for today. creating one')
                await createDailyThread(prettyDate, threadContent)
                .then(() => {
                    current.streams = streams
                    console.log(`daily thread created for ${prettyDate}`)
                })
            } else if (await needToUpdate(streams)) {
                await updateThread(threadContent)
            }
        }
    } catch (err) {
        console.log(err)
    }

    setTimeout(run, delayInMinutes*60000)
}

async function needToUpdate(streams) {
    const needTo = JSON.stringify(current.streams) !== JSON.stringify(streams)

    if (needTo) {
        console.log('need to update thread')
        current.streams = streams
    }

    return needTo
}

async function updateThread(threadContent) {
    console.log('updating thread')
    await r.getSubmission(current.tid).edit(threadContent).then(() => { console.log('thread updated') })
}

async function checkForThread(date) {
    let found = false
    const findTitle = `${date} Protest Stream Discussion`

    if (current.date !== null && current.date !== date) {
        return found
    }

    // if bot was restarted midday, we don't want to overwrite the existing day's thread
    await r.getSubreddit(process.env.SUBREDDIT).getHot().then((submissions) => {
        for (let s of submissions.filter(sub => sub.stickied)) {
            console.log(s.author.name)
            if (s.title === findTitle && s.author.name.toLowerCase() === process.env.REDDITUSER.toLowerCase()) {
                current.tid = s.id
                current.date = date
                current.content = s.selftext
                found = true
                break
            }
        }
    })

    return found
}

async function createDailyThread(date, content) {
    console.log("creating daily thread")
    r.getSubreddit(process.env.SUBREDDIT)
        .submitSelfpost({title: `${date} Protest Stream Discussion`, text: content})
        .sticky()
        .distinguish()
        .approve()
        .then((submission) => {
            current.date = date,
            current.tid = submission.id
        })
}

async function formatThread(date, streams) {
    let recents = ''
    for (let s of streams.recent) {
        recents += `| [${s.source}](${s.link}) | ${s.state} | ${s.city} | ${s.platform} | ${s.status} |\n`
    }

    let archived = ''
    for (let s of streams.archived) {
        archived += `| [${s.source}](${s.link}) | ${s.state} | ${s.city} | ${s.platform} |\n`
    }

    let content = `
**Please use this thread to discuss daily live protest links from ${date}**



*Recent Live Streams*


| Source                              | State | City           | Platform  | Status  |
|-------------------------------------|-------|----------------|-----------|---------|
${recents}

*${date} Stream Archive*


| Source                              | State | City           | Platform  |  
|-------------------------------------|-------|----------------|-----------|  
${archived}
`

    return content
}

async function getStreams() {
    const streamsListAPI = "https://woke.net/api/streams.json"
    //date will need to be yyyy-mm-dd
    const d = new Date();
    const ye = new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'America/Los_Angeles' }).format(d)
    const mo = new Intl.DateTimeFormat('en-US', { month: '2-digit', timeZone: 'America/Los_Angeles' }).format(d)
    const da = new Intl.DateTimeFormat('en-US', { day: '2-digit', timeZone: 'America/Los_Angeles' }).format(d)

    const recent = await axios.get(streamsListAPI).catch((err) => {
        console.log(err)
    })
    const archived = await axios.get(`${streamsListAPI}?date=${ye}-${mo}-${da}`).catch((err) => {
        console.log(err)
    })

    try {
        return {recent: recent.data, archived: archived.data}
    } catch (err) {
        console.log(err)
        return false
    }
}