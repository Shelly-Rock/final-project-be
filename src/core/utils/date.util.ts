export const isDateInPastOrToday = (date: Date | string): boolean => {
  if (!date) return false;
  const inputDate = new Date(date);
  const today = new Date();

  inputDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return inputDate.getTime() <= today.getTime();
};
