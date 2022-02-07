import {HttpFunction} from '@google-cloud/functions-framework/build/src/functions';
import { randomUUID } from 'crypto';
import {OAuth2Client} from 'google-auth-library';
import { blogger_v2, calendar_v3, google } from 'googleapis';
import { CalendarEvent, Individual } from './models';

const CLIENT_ID =
  '436668816969-l4uica2hifv8ua5sbsaokj5dfoboje2u.apps.googleusercontent.com';

const allowedOrigins = [
  "http://localhost:3000",
  "https://poetic-tube-331012.web.app"
]

/*
Function Arguments:
{
    id_token: token obj
}
*/
export const getCalendar: HttpFunction = async (req, res) => {
  const origin = req.headers.origin

  if (origin) {
    if (allowedOrigins.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin)
      res.set('Access-Control-Allow-Headers', "content-type")
    }
    else {
      res.status(403).send("Origin not allowed")
    }
  }

  if (req.method === 'OPTIONS') {
    // CORS Preflight
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Max-Age', '3600');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
  }
  else {
    try {
      const idToken = JSON.parse(req.body.id_token);

      if (!idToken) {
        res.status(400).send('Missing function parameters');
        return;
      }
    
      const oAuth2Client = new OAuth2Client(CLIENT_ID);
      const validToken = await verify(idToken.id_token, oAuth2Client)
    
      if (!validToken.valid) {
          res.status(403).send(validToken.message)
          return
      }
  
      oAuth2Client.setCredentials(idToken)
  
      console.log(idToken)
   
      const eventsPromise = fetchEventsFromAPI(oAuth2Client, new Date());

      eventsPromise.then(events => {
        res.status(200).send(events);
      })
      .catch(error => {
        res.status(500).send(error)
      })
    } catch (error) {
      res.status(500).send(error)
    }
  }
};

async function fetchEventsFromAPI(auth: OAuth2Client, today: Date): Promise<CalendarEvent[]> {
  function getDateRange(date: Date): {start: Date; end: Date} {
    const year = date.getFullYear();
    const month = date.getMonth();
    const startDaysOffset = new Date(year, month, 0).getDay();

    const start = new Date(year, month, -startDaysOffset);

    const daysThisMonth = new Date(year, month + 1, 0).getDate();
    const endMonthDate = 35 - (daysThisMonth + -1 * startDaysOffset + 1);

    const end = new Date(year, month + 1, endMonthDate);

    return {start, end};
  }

  const dateRange = getDateRange(today)

  const calendar = google.calendar({version: 'v3', auth});
  const resp = await calendar.events.list({
    calendarId: 'primary',
    singleEvents: true,
    orderBy: "startTime",
    timeMin: dateRange.start.toISOString(),
    timeMax: dateRange.end.toISOString()
  }).catch((reason) => {
    throw new Error(reason)
  })

  const events = resp.data.items;

  function parseEvent(event: calendar_v3.Schema$Event): CalendarEvent {
    function parseDate(event: calendar_v3.Schema$Event): Date {
      if (event.start) {
        if (event.start.dateTime) {
          return new Date(event.start.dateTime)
        }
        else if (event.start.date) {
          return new Date(event.start.date)
        }
        else {
          throw new ReferenceError
        }
      }
      else if (event.end) {
        if (event.end.dateTime) {
          return new Date(event.end.dateTime)
        }
        else if (event.end.date) {
          return new Date(event.end.date)
        }
        else {
          throw new ReferenceError
        }
      }
      else {
        throw new ReferenceError
      }
    }

    function getInPerson(event:  calendar_v3.Schema$Event): boolean {
      const hasLocation = !!event.location

      let hasMeetingLink = !!event.hangoutLink

      const description = event.description
      if (description !== undefined && description !== null) {
        const keywords = ["zoom", "skype", "facetime"]

        const results = description.match(new RegExp(keywords.join("|"), "i"))

        hasMeetingLink = hasMeetingLink || !results
      }

      if (hasLocation) {
        return true
      } else {
        return !hasMeetingLink
      }
    }

    const calendarEvent: CalendarEvent = {
      label: event.summary ? event.summary : "",
      date: parseDate(event),
      inPerson: getInPerson(event),
      eventID: event.id ? event.id : randomUUID(),
      attendees: event.attendees ? event.attendees.map(attendee => {
        const individual: Individual = {
          name: attendee.displayName ? attendee.displayName : "Unknown",
          email: attendee.email ? attendee.email : "Unknown"
        }

        return individual
      }) : []
    }

    return calendarEvent
  }

  if (events) {
    const returner: CalendarEvent[] = []

    events.forEach((event) => {
      try {
        const calendarEvent = parseEvent(event)
    
        returner.push(calendarEvent)
      } catch (error) {
        // Do nothing here since the event cannot be parsed correctly and hence cannot be contact traced
      }
    });

    return returner
  }
  else {
    return []
  }
}

async function verify(
  token: any,
  client: OAuth2Client
): Promise<{valid: boolean; message?: string}> {
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: CLIENT_ID,
  });
  const payload = ticket.getPayload();

  if (payload) {
    return {
      valid: true,
    };
  } else {
    return {
      valid: false,
      message: 'Invalid Token',
    };
  }
}
