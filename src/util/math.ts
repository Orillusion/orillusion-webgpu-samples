import { mat4, vec3 } from 'gl-matrix'

const fov:number = (2 * Math.PI) / 5
const near:number = 0.1
const far:number = 100.0
// return mvp matrix from given aspect, position, rotation, scale
function getMvpMatrix(
    aspect: number,
    positioin: {x:number, y:number, z:number},
    rotation: {x:number, y:number, z:number},
    scale: {x:number, y:number, z:number}
){
    // get modelView Matrix
    const viewMatrix = mat4.create()
    // translate position
    mat4.translate(viewMatrix, viewMatrix, vec3.fromValues(positioin.x, positioin.y, positioin.z))
    // rotate
    mat4.rotateX(viewMatrix, viewMatrix, rotation.x)
    mat4.rotateY(viewMatrix, viewMatrix, rotation.y)
    mat4.rotateZ(viewMatrix, viewMatrix, rotation.z)
    // scale
    mat4.scale(viewMatrix, viewMatrix, vec3.fromValues(scale.x, scale.y, scale.z))
    
    // get a perspective Matrix
    const projectionMatrix = mat4.create()
    mat4.perspective(projectionMatrix, fov, aspect, near, far)
    
    // get mvp matrix
    const modelViewProjectionMatrix = mat4.create()
    mat4.multiply(modelViewProjectionMatrix, projectionMatrix, viewMatrix)
    
    // return matrix as Float32Array
    return modelViewProjectionMatrix as Float32Array
}

export { getMvpMatrix }