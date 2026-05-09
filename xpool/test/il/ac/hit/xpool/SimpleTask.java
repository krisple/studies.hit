package il.ac.hit.xpool;

/**
 * A reusable task implementation for testing purposes.
 */
public class SimpleTask implements Task {

    /**
     * The priority level of this task.
     */
    private int priority;

    /**
     * Default constructor with zero priority.
     */
    public SimpleTask() {
        this(0);
    }

    /**
     * Constructor that sets the initial priority.
     * 
     * @param priority The priority level.
     */
    public SimpleTask(int priority) {
        super();
        setPriority(priority);
    }

    /**
     * Performs the task logic. Default implementation is empty.
     */
    @Override
    public void perform() {
        // empty implementation for tests to override if needed
    }

    /**
     * Sets the task priority.
     * 
     * @param level The new priority level.
     */
    @Override
    public void setPriority(int level) {
        this.priority = level;
    }

    /**
     * Retrieves the task priority.
     * 
     * @return The current priority level.
     */
    @Override
    public int getPriority() {
        return priority;
    }
}
