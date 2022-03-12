// check chrome version number
const version:number = (()=>{
    const chrome = navigator.userAgent.match(/Chrome\/\d+/)
    if(chrome && chrome[0])
        return +chrome[0].slice(7)
    return 0
})()

// parse shader format based on chrome version
const getShader = (code:string):string  => {
    if(version < 100)
        code = code.replace(/\@(\w+\((\w+|\d+)\))/g, '[[$1]]')
    if(version < 99)
        code = code.replace(/struct\s/g, '[[block]] struct ')
    return code
}

export { version, getShader}