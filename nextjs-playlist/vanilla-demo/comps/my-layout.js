import Header from './header';
import { EPROTONOSUPPORT } from 'constants';
const lStyle = {
    margin: 20,
    padding: 20,
    border: '1px solid #ddd'
}

export default ({children}) => (
    <div style={lStyle}>
        <Header />
        {children}
    </div>
)