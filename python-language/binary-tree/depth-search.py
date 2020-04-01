"""
Depth first search for containment

1. Idea tis to keep a data structure (a stack) that holds nodes still to be explored

2. Use an evaluation function to determine when reach objective (i.e. for containment, whether value of node is equal to desired value)

3. Start with the root node

4. Then add children, if any,  to front of data structure, with left branch first

5. Continue in this manner
"""

def DFSBinary(root, fcn):
    stack = [root]
    while len(stack) >  0:
        if fcn(stack[0]):
            return True
        else:
            temp = stack.pop()
            if temp.getRightBranch():
                stack.insert(0, temp.getRightBranch())
            if temp.getLeftBranch():
                stack.insert(0, temp.getLeftBranch())
    return False

def BFSBinary(root, fcn):
    queue = [root]
    while len(queue) > 0:
        if fcn(queue[0]):
            return True
        else:
            temp = queue.pop(0)
            if temp.getLeftBranch():
                queue.append(temp.getLeftBranch())
            if temp.getRightBranch():
                queue.append(temp.getRightBranch())
    return False