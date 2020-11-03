
export default {
    format: (timeStamp) => {
        let date = new Date(parseInt(timeStamp));
        date.setHours(date.getHours() + 2);
        date.setMinutes(0);
        date.setSeconds(0);
        date.setMilliseconds(0);
        return date;
    }
}