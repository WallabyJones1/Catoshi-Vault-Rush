'use strict';
// Multiplayer identity validation is independent of solo replay and wallet code.
class HttpError extends Error {constructor(status,message){super(message);this.status=status;}}
function playerName(value){
 const name=String(value||'Runner').normalize('NFKC').trim().replace(/\s+/g,' ');
 if(!/^[\p{L}\p{N} ._-]{2,20}$/u.test(name))throw new HttpError(400,'Use 2–20 characters: letters, numbers, spaces, dot, dash or underscore.');
 return name;
}
module.exports={HttpError,playerName};
