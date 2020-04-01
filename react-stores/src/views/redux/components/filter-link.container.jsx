import { connect } from 'react-redux';
import { setVisibilityFilter } from '../actions';
import Link from './link.dummy';

const mapStateToProps = (state, ownProps) => ({
    active: ownProps.filter === state.visibilityFilter
});

const mapDispatchToProps = (dispatch, ownProps) => ({
    onClick: _ => dispatch(setVisibilityFilter(ownProps.filter))
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(Link)