package il.ac.hit.xpool;

import java.util.Comparator;

/**
 * Comparator implementation for Task objects.
 * Tasks are sorted in descending order of priority (highest priority first).
 */
public class TaskComparator implements Comparator<Task> {

    /**
     * Primary constructor for TaskComparator.
     */
    public TaskComparator() {
        super();
    }

    /**
     * Compares two tasks based on their priority levels.
     * 
     * @param first  The first task to compare.
     * @param second The second task to compare.
     * @return A negative integer if the first task has higher priority,
     *         a positive integer if the second task has higher priority,
     *         or zero if they are equal.
     * @throws XPoolException if either of the compared tasks is null.
     */
    @Override
    public int compare(Task first, Task second) {
        if (first == null || second == null) {
            throw new XPoolException("Cannot compare null task objects");
        }

        /*
         * We use Integer.compare(second, first) to achieve descending order.
         * This avoids overflow issues that can occur with direct subtraction.
         */
        return Integer.compare(second.getPriority(), first.getPriority());
    }

    /**
     * Returns a string representation of this task comparator.
     * 
     * @return A string representation of the comparator.
     */
    @Override
    public String toString() {
        return "TaskComparator{}";
    }
}
