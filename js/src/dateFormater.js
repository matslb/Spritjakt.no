export default {
  format: (date) => {
    return (
      addZero(date.getDate()) +
      "-" +
      addZero(date.getMonth() + 1) +
      "-" +
      date.getFullYear()
    );
  },
  parse: (timeStamp) => {
    let date = new Date(parseInt(timeStamp));
    date.setHours(date.getHours() + 2);
    date.setMinutes(0);
    date.setSeconds(0);
    date.setMilliseconds(0);
    return date;
  },
};

function addZero(n) {
  if (n < 10) {
    return "0" + n;
  }

  return n;
}
