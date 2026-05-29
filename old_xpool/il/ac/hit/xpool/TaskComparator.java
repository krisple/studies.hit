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
     * Uses Integer.compare to prevent potential overflow from subtraction.
     * 
     * @param firstTask  The first task to compare.
     * @param secondTask The second task to compare.
     * @return A negative integer if the first task has higher priority,
     *         a positive integer if the second task has higher priority,
     *         or zero if they are equal.
     */
    @Override
    public int compare(Task firstTask, Task secondTask) {
        // validating arguments
        if (firstTask == null || secondTask == null) {
            throw new XPoolException("Cannot compare null task objects");
        }

        /*
         * We use Integer.compare(second, first) to achieve descending order.
         * This avoids overflow issues that can occur with direct subtraction.
         */
        return Integer.compare(secondTask.getPriority(), firstTask.getPriority());
    }
}
