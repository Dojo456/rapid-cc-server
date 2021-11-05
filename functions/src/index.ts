import {HttpFunction} from '@google-cloud/functions-framework/build/src/functions';
import { randomUUID } from 'crypto';
import {OAuth2Client} from 'google-auth-library';
import {CalendarEvent} from '../models';

const CLIENT_ID =
  '436668816969-l4uica2hifv8ua5sbsaokj5dfoboje2u.apps.googleusercontent.com';

/*
Function Arguments:
{
    id_token: id_token obj
}
*/
export const getCalendar: HttpFunction = async (req, res) => {
  res.set('Access-Control-Allow-Origin', "http://localhost:3000")
  res.set('Access-Control-Allow-Methods', 'GET, POST');

  // const token = req.body.id_token;

  // if (!token) {
  //   res.status(400).send('Missing id_token');
  //   return;
  // }

  // const oAuth2Client = new OAuth2Client(CLIENT_ID);
  // const validToken = await verify(token, oAuth2Client)

  // if (!validToken.valid) {
  //     res.status(403).send(validToken.message)
  // }

  const returner = await fetchEventsFromAPI(10, new Date());

  res.status(200).send(returner);
};

async function fetchEventsFromAPI(count: number, today: Date): Promise<CalendarEvent[]> {
  const returner: CalendarEvent[] = [];

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

  function newEvent(date: Date): CalendarEvent {
    return {
      label: 'today',
      date: date,
      eventID: randomUUID(),
      attendees: [
        {
          name: 'Daniel',
          email: 'yazhengliao@gmail.com',
        },
      ],
    };
  }

  // Below function taken from https://www.codegrepper.com/code-examples/javascript/generate+random+date+in+javascript
  function randomDate(start: Date, end: Date) {
    return new Date(
      start.getTime() + Math.random() * (end.getTime() - start.getTime())
    );
  }

  const dateRange = getDateRange(today);

  for (let i = 0; i < count; i++) {
    returner.push(newEvent(randomDate(dateRange.start, dateRange.end)));
  }

  return returner;
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
