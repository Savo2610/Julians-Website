import * as THREE from 'three'
const { terrainHeight, terrainNormal, findFlatSpot } = await import('./src/world/heightfield.js')
const n=new THREE.Vector3()
const deg=(x,z)=>{terrainNormal(x,z,n);return (Math.acos(Math.min(1,n.y))*180/Math.PI)}
const LB={x:-34,z:-8}, L=Math.hypot(29,47), ux=-29/L, uz=-47/L
const liftD=(x,z)=>Math.abs((x-LB.x)*(-uz)+(z-LB.z)*ux)
const dx=0.5252, dz=0.8511, nx=dz, nz=-dx
console.log('Speedcheck 90 Grad zum Lift, tiefer:')
for (const t of [0,4,6,8,10]) {
  const x=-37.2+dx*t, z=-31.8+dz*t
  const cam=[x+nx*5,z+nz*5], ref=[x-nx*5,z-nz*5]
  console.log(` +${t}: (${x.toFixed(1)},${z.toFixed(1)}) ${deg(x,z).toFixed(1)}deg h${terrainHeight(x,z).toFixed(2)} | Kamera ${cam.map(v=>v.toFixed(1))} h${terrainHeight(...cam).toFixed(2)} liftD ${liftD(...cam).toFixed(1)} | Reflektor ${ref.map(v=>v.toFixed(1))} h${terrainHeight(...ref).toFixed(2)} liftD ${liftD(...ref).toFixed(1)} | dh ${(terrainHeight(...cam)-terrainHeight(...ref)).toFixed(2)}`)
}
console.log('\nSchneekanone ueber der alten Kameraposition (-32.2,-32.3):')
for (const t of [4,5.5,7,9]) {
  const x=-32.2-dx*t, z=-32.3-dz*t
  const f=findFlatSpot(x,z,3,2.0)
  console.log(` -${t}: (${x.toFixed(1)},${z.toFixed(1)}) ${deg(x,z).toFixed(1)}deg -> flach (${f.x.toFixed(1)},${f.z.toFixed(1)}) ${deg(f.x,f.z).toFixed(1)}deg h${terrainHeight(f.x,f.z).toFixed(2)} liftD ${liftD(f.x,f.z).toFixed(1)}`)
}
