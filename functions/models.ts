export type Individual = {
  name: string;
  email: string;
};

export type CalendarEvent = {
  label: string;
  inPerson?: boolean;
  attendees: Individual[];
  eventID: string;
  date: Date;
};
