import { database } from "firebase";

export default {
    format: (timeStamp) => {
        let date = new Date(parseInt(timeStamp));
        date.setHours(date.getHours() + 2);
        date.setMinutes(0);
        date.setSeconds(0);
        date.setMilliseconds(0);
        return addZero(date.getDate()) + "-" + addZero(date.getMonth()) + "-" + date.getFullYear();
    }
}

function addZero(n){
    if(n < 10){
        return "0"+ n;
    }
    
    return n;
}