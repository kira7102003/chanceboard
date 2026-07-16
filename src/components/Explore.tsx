interface Props { onClose: () => void }
export default function Explore({ onClose }: Props) { return <div className="panel-overlay explore-screen"><div className="panel-header"><button className="panel-back" onClick={onClose}>← 返回大廳</button><span className="panel-title">🧭 探索</span></div><div className="explore-coming"><span>🗺️</span><h2>探索功能準備中</h2><p>入口已建立，後續可加入地圖、事件與探索獎勵。</p></div></div> }
